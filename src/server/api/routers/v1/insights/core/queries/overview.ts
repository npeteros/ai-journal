import type { Mood } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { getEntryStats, shiftDay, toDay, toLocalDay } from '../../../entry/core/queries/stats'
import { InsightsOverviewSchema, RECENT_WINDOW_DAYS, TOP_THEMES_MAX_COUNT } from '../../schema'

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
  /** Entries per mood over the last `RECENT_WINDOW_DAYS` days, most common first. */
  moodMix: { mood: Mood; count: number }[]
  /** Share (0–100) of analyzed entries in the last `RECENT_WINDOW_DAYS` days mentioning each theme. */
  topThemes: { label: string; pct: number }[]
  entriesThisMonth: number
  /** Consecutive days with an entry, ending today (or yesterday while today is still empty). */
  currentStreak: number
  /** All-time analyzed entries; gates the charts behind `INSIGHTS_MIN_ANALYZED_ENTRIES`. */
  analyzedCount: number
}

/** Moves a "YYYY-MM" month by `months`. */
const shiftMonth = (month: string, months: number) => {
  const d = new Date(`${month}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 7)
}

/** `@db.Date` value for a "YYYY-MM-DD" day. */
const toEntryDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** Every date window the overview uses, derived from one "today" so they always agree. */
export function overviewWindows(today: string) {
  const thisMonth = today.slice(0, 7)
  const weekDays = Array.from({ length: WEEK_DAYS }, (_, i) => shiftDay(today, i - (WEEK_DAYS - 1)))
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) =>
    shiftMonth(thisMonth, i - (TREND_MONTHS - 1)),
  )
  const recentStart = shiftDay(today, -(RECENT_WINDOW_DAYS - 1))
  const trendStart = `${trendMonths[0]}-01`

  return {
    today,
    weekDays,
    trendMonths,
    recentStart,
    /** Earliest day any chart needs; older rows are never loaded. */
    since: recentStart < trendStart ? recentStart : trendStart,
    monthStart: `${thisMonth}-01`,
    nextMonthStart: `${shiftMonth(thisMonth, 1)}-01`,
  }
}

type OverviewWindows = ReturnType<typeof overviewWindows>

function average(scores: number[]) {
  return scores.length === 0
    ? null
    : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

/** Averages `moodScore` per key; keys with no analyzed entries come back as null. */
function averageByKey(rows: AnalyzedRow[], keyOf: (day: string) => string, keys: string[]) {
  const scores = new Map<string, number[]>(keys.map((key) => [key, []]))
  for (const { entryDate, analysis } of rows) {
    if (analysis) scores.get(keyOf(toDay(entryDate)))?.push(analysis.moodScore)
  }
  return keys.map((key) => average(scores.get(key) ?? []))
}

/** The spelling used most often; ties go to the lowest code point so the label is stable. */
function mostFrequentSpelling(spellings: Map<string, number>) {
  let best = ''
  let bestCount = 0
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling < best)) {
      best = spelling
      bestCount = count
    }
  }
  return best
}

function countThemes(rows: AnalyzedRow[]) {
  const themes = new Map<string, { count: number; spellings: Map<string, number> }>()

  for (const { analysis } of rows) {
    // A theme counts once per entry, however many times the analysis repeats it.
    const seen = new Set<string>()
    for (const raw of analysis?.themes ?? []) {
      const spelling = raw.trim()
      const key = spelling.toLowerCase()
      if (key === '' || seen.has(key)) continue
      seen.add(key)

      const theme = themes.get(key) ?? { count: 0, spellings: new Map<string, number>() }
      theme.count += 1
      theme.spellings.set(spelling, (theme.spellings.get(spelling) ?? 0) + 1)
      themes.set(key, theme)
    }
  }

  return [...themes.values()]
    .map(({ count, spellings }) => ({ label: mostFrequentSpelling(spellings), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP_THEMES_MAX_COUNT)
}

/** Pure aggregation over analyzed entries since `windows.since`: no AI calls. */
export function buildOverview(
  rows: AnalyzedRow[],
  windows: OverviewWindows,
  counts: Pick<InsightsOverview, 'entriesThisMonth' | 'currentStreak' | 'analyzedCount'>,
): InsightsOverview {
  const weekAverages = averageByKey(rows, (day) => day, windows.weekDays)
  const monthAverages = averageByKey(rows, (day) => day.slice(0, 7), windows.trendMonths)

  const recentRows = rows.filter(({ entryDate }) => {
    const day = toDay(entryDate)
    return day >= windows.recentStart && day <= windows.today
  })

  const moodCounts = new Map<Mood, number>()
  for (const { analysis } of recentRows) {
    if (analysis) moodCounts.set(analysis.mood, (moodCounts.get(analysis.mood) ?? 0) + 1)
  }

  return {
    moodThisWeek: windows.weekDays.map((date, i) => ({ date, value: weekAverages[i] })),
    emotionalTrend: windows.trendMonths.map((month, i) => ({ month, value: monthAverages[i] })),
    moodMix: [...moodCounts.entries()]
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
    topThemes: countThemes(recentRows).map(({ label, count }) => ({
      label,
      pct: Math.round((count / recentRows.length) * 100),
    })),
    ...counts,
  }
}

export const overview = protectedProcedure
  .input(InsightsOverviewSchema)
  .query(async ({ ctx, input }): Promise<InsightsOverview> => {
    const userId = ctx.user.id
    const now = new Date()
    const windows = overviewWindows(toLocalDay(now, input.timeZone))
    const live = { userId, deletedAt: null }

    const [rows, entriesThisMonth, analyzedCount, stats] = await Promise.all([
      prisma.entry.findMany({
        where: {
          ...live,
          analysis: { isNot: null },
          entryDate: { gte: toEntryDate(windows.since) },
        },
        select: {
          entryDate: true,
          analysis: { select: { mood: true, moodScore: true, themes: true } },
        },
      }),
      prisma.entry.count({
        where: {
          ...live,
          entryDate: {
            gte: toEntryDate(windows.monthStart),
            lt: toEntryDate(windows.nextMonthStart),
          },
        },
      }),
      prisma.entry.count({ where: { ...live, analysis: { isNot: null } } }),
      getEntryStats(prisma, userId, { timeZone: input.timeZone }, now),
    ])

    return buildOverview(rows, windows, {
      entriesThisMonth,
      currentStreak: stats.currentStreak,
      analyzedCount,
    })
  })
