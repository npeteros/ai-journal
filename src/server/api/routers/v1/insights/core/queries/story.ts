import { Prisma, type Mood } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { monthStart, shiftMonth, toDay, toLocalDay } from '../../../entry/core/queries/stats'
import { STORY_PAGE_MONTHS, STORY_QUOTE_MAX_LENGTH, StorySchema } from '../../schema'
import {
  MONTHLY_STORY_MAX_GENERATIONS_PER_REQUEST,
  scheduleMonthlyStories,
  type MissingMonthlyStory,
} from '../../services/MonthlyStoryService'

type StoryRow = {
  id: string
  title: string
  entryDate: Date
  writtenAt: Date
  updatedAt: Date
  analysis: { mood: Mood; moodScore: number; analyzedAt: Date } | null
}

export type StoryQuote = { entryId: string; text: string; title: string; date: string }

export type StoryMonth = {
  month: string
  entryCount: number
  mood: Mood | null
  summary: string | null
  quote: StoryQuote
  finished: boolean
}

export type StoryPage = {
  months: StoryMonth[]
  highlight: StoryQuote | null
  nextCursor: string | null
  currentMonth: string
}

export function mainMood(rows: { analysis: { mood: Mood } | null }[]): Mood | null {
  const counts = new Map<Mood, number>()
  for (const { analysis } of rows) {
    if (analysis) counts.set(analysis.mood, (counts.get(analysis.mood) ?? 0) + 1)
  }
  let best: Mood | null = null
  for (const [mood, count] of counts) {
    const bestCount = best ? (counts.get(best) ?? 0) : 0
    if (count > bestCount || (count === bestCount && best && mood < best)) best = mood
  }
  return best
}

export function pickQuoteEntry<
  T extends { writtenAt: Date; analysis: { moodScore: number } | null },
>(rows: T[]) {
  const score = (row: T) => row.analysis?.moodScore ?? -1
  return rows.reduce((best, row) =>
    score(row) > score(best) ||
    (score(row) === score(best) && row.writtenAt.getTime() > best.writtenAt.getTime())
      ? row
      : best,
  )
}

export function openingSentence(body: string, max = STORY_QUOTE_MAX_LENGTH) {
  const text = body.replace(/\s+/g, ' ').trim()
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text
  if (sentence.length <= max) return sentence
  const cut = sentence.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut.slice(0, max - 1)).replace(/[\s,;:.!?-]+$/, '')}…`
}

export function monthFingerprint(rows: Pick<StoryRow, 'updatedAt' | 'analysis'>[]) {
  const latest = Math.max(
    ...rows.flatMap(({ updatedAt, analysis }) => [
      updatedAt.getTime(),
      analysis?.analyzedAt.getTime() ?? 0,
    ]),
  )
  return `${rows.length}:${new Date(latest).toISOString()}`
}

export const story = protectedProcedure
  .input(StorySchema)
  .query(async ({ ctx, input }): Promise<StoryPage> => {
    const userId = ctx.user.id
    const live = { userId, deletedAt: null }
    const currentMonth = toLocalDay(new Date(), input.timeZone).slice(0, 7)

    const monthRows = await prisma.$queryRaw<{ month: string }[]>`
      SELECT DISTINCT to_char("entryDate", 'YYYY-MM') AS month
      FROM "entry"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        ${input.cursor ? Prisma.sql`AND "entryDate" < ${monthStart(input.cursor)}` : Prisma.empty}
      ORDER BY month DESC
      LIMIT ${STORY_PAGE_MONTHS + 1}
    `
    const pageMonths = monthRows.slice(0, STORY_PAGE_MONTHS).map(({ month }) => month)
    if (pageMonths.length === 0) {
      return { months: [], highlight: null, nextCursor: null, currentMonth }
    }

    const finishedMonths = pageMonths.filter((month) => month < currentMonth)
    const pageRange = {
      gte: monthStart(pageMonths[pageMonths.length - 1]),
      lt: monthStart(shiftMonth(pageMonths[0], 1)),
    }
    const [rows, withBody, stories] = await Promise.all([
      prisma.entry.findMany({
        where: { ...live, entryDate: pageRange },
        select: {
          id: true,
          title: true,
          entryDate: true,
          writtenAt: true,
          updatedAt: true,
          analysis: { select: { mood: true, moodScore: true, analyzedAt: true } },
        },
        orderBy: [{ entryDate: 'desc' }, { writtenAt: 'desc' }],
      }),
      prisma.entry.findMany({
        where: { ...live, entryDate: pageRange, NOT: { body: '' } },
        select: { id: true },
      }),
      prisma.monthlyStory.findMany({
        where: { userId, month: { in: finishedMonths }, generatedAt: { not: null } },
        select: { month: true, summary: true, fingerprint: true },
      }),
    ])

    const byMonth = new Map<string, StoryRow[]>(pageMonths.map((month) => [month, []]))
    for (const row of rows) byMonth.get(toDay(row.entryDate).slice(0, 7))?.push(row)

    const hasBody = new Set(withBody.map(({ id }) => id))
    const picks = pageMonths.flatMap((month) => {
      const monthRows = byMonth.get(month) ?? []
      const candidates = monthRows.filter(({ id }) => hasBody.has(id))
      return monthRows.length > 0
        ? [
            {
              month,
              rows: monthRows,
              quote: pickQuoteEntry(candidates.length ? candidates : monthRows),
            },
          ]
        : []
    })
    const bodies = await prisma.entry.findMany({
      where: { ...live, id: { in: picks.map(({ quote }) => quote.id) } },
      select: { id: true, body: true },
    })
    const bodyById = new Map(bodies.map(({ id, body }) => [id, body]))
    const storyByMonth = new Map(stories.map((s) => [s.month, s]))

    const fingerprints = new Map(picks.map(({ month, rows }) => [month, monthFingerprint(rows)]))
    const months: StoryMonth[] = picks.map(({ month, rows: monthRows, quote }) => {
      const stored = storyByMonth.get(month)
      return {
        month,
        entryCount: monthRows.length,
        mood: mainMood(monthRows),
        summary: stored && stored.fingerprint === fingerprints.get(month) ? stored.summary : null,
        quote: {
          entryId: quote.id,
          text: openingSentence(bodyById.get(quote.id) ?? '') || quote.title,
          title: quote.title,
          date: toDay(quote.entryDate),
        },
        finished: month < currentMonth,
      }
    })

    const missing: MissingMonthlyStory[] = months
      .filter(
        ({ month, finished, summary }) =>
          finished && !summary && byMonth.get(month)?.some(({ analysis }) => analysis),
      )
      .slice(0, MONTHLY_STORY_MAX_GENERATIONS_PER_REQUEST)
      .map(({ month, mood, entryCount }) => ({
        month,
        mood,
        entryCount,
        fingerprint: fingerprints.get(month)!,
      }))
    scheduleMonthlyStories(userId, missing)

    return {
      months,
      highlight: input.cursor ? null : (months.find(({ finished }) => finished)?.quote ?? null),
      nextCursor: monthRows.length > STORY_PAGE_MONTHS ? pageMonths[pageMonths.length - 1] : null,
      currentMonth,
    }
  })
