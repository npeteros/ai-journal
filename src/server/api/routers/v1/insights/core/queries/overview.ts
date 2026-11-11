import type { Mood } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { getEntryDate } from '../../../entry/core/mutations/shared'
import { InsightsOverviewSchema, TOP_THEMES_MAX_COUNT } from '../../schema'

const DAY_MS = 86_400_000
const WEEK_DAYS = 7
const TREND_MONTHS = 6

type AnalyzedRow = {
  entryDate: Date
  analysis: { mood: Mood; moodScore: number; themes: string[] } | null
}

type DayPoint = { date: string; value: number | null }
type MonthPoint = { month: string; value: number | null }

export type InsightsOverview = {
  /** Last 7 days in the user's time zone, oldest first. `value` is null without analyzed entries. */
  moodThisWeek: DayPoint[]
  /** Last 6 calendar months including the current one, oldest first. */
  emotionalTrend: MonthPoint[]
  /** Entries per mood, most common first. Moods with no entries are left out. */
  moodMix: { mood: Mood; count: number }[]
  /** Share (0–100) of analyzed entries that mention each theme. */
  topThemes: { label: string; pct: number }[]
  entriesThisMonth: number
  analyzedCount: number
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10)
const monthKey = (date: Date) => date.toISOString().slice(0, 7)

function average(scores: number[]) {
  return scores.length === 0
    ? null
    : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

/** Averages `moodScore` per key; keys with no analyzed entries come back as null. */
function averageByKey(rows: AnalyzedRow[], keyOf: (entryDate: Date) => string, keys: string[]) {
  const scores = new Map<string, number[]>(keys.map((key) => [key, []]))
  for (const { entryDate, analysis } of rows) {
    if (analysis) scores.get(keyOf(entryDate))?.push(analysis.moodScore)
  }
  return keys.map((key) => average(scores.get(key) ?? []))
}

function countThemes(rows: AnalyzedRow[]) {
  const counts = new Map<string, { label: string; count: number }>()

  for (const { analysis } of rows) {
    // A theme counts once per entry, however many times the analysis repeats it.
    const seen = new Set<string>()
    for (const raw of analysis?.themes ?? []) {
      const label = raw.trim()
      const key = label.toLowerCase()
      if (key === '' || seen.has(key)) continue
      seen.add(key)

      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { label, count: 1 })
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP_THEMES_MAX_COUNT)
    .map(({ label, count }) => ({ label, count }))
}

/** Pure aggregation over analyzed entries: no AI calls. `now` is read in the user's time zone. */
export function buildOverview(
  rows: AnalyzedRow[],
  entriesThisMonth: number,
  now: Date,
  timeZone: string,
): InsightsOverview {
  const today = getEntryDate(now, timeZone)

  const weekDates = Array.from(
    { length: WEEK_DAYS },
    (_, i) => new Date(today.getTime() - (WEEK_DAYS - 1 - i) * DAY_MS),
  )
  const weekKeys = weekDates.map(dayKey)
  const weekAverages = averageByKey(rows, dayKey, weekKeys)

  const monthKeys = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const offset = TREND_MONTHS - 1 - i
    return monthKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)))
  })
  const monthAverages = averageByKey(rows, monthKey, monthKeys)

  const moodCounts = new Map<Mood, number>()
  for (const { analysis } of rows) {
    if (analysis) moodCounts.set(analysis.mood, (moodCounts.get(analysis.mood) ?? 0) + 1)
  }

  const analyzedCount = rows.length

  return {
    moodThisWeek: weekKeys.map((date, i) => ({ date, value: weekAverages[i] })),
    emotionalTrend: monthKeys.map((month, i) => ({ month, value: monthAverages[i] })),
    moodMix: [...moodCounts.entries()]
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
    topThemes: countThemes(rows).map(({ label, count }) => ({
      label,
      pct: Math.round((count / analyzedCount) * 100),
    })),
    entriesThisMonth,
    analyzedCount,
  }
}

export const overview = protectedProcedure
  .input(InsightsOverviewSchema)
  .query(async ({ ctx, input }): Promise<InsightsOverview> => {
    const userId = ctx.user.id
    const now = new Date()
    const today = getEntryDate(now, input.timeZone)
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))

    const [rows, entriesThisMonth] = await Promise.all([
      prisma.entry.findMany({
        where: { userId, deletedAt: null, analysis: { isNot: null } },
        select: {
          entryDate: true,
          analysis: { select: { mood: true, moodScore: true, themes: true } },
        },
      }),
      prisma.entry.count({
        where: { userId, deletedAt: null, entryDate: { gte: monthStart, lt: nextMonthStart } },
      }),
    ])

    return buildOverview(rows, entriesThisMonth, now, input.timeZone)
  })
