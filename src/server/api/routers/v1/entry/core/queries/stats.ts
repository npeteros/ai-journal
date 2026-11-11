import { z } from 'zod'

import type { PrismaClient } from '@/src/generated/prisma/client'
import { timeZoneSchema } from '../../schema'

export const entryStatsInput = z.object({
  timeZone: timeZoneSchema,
})

export type DayCount = { entryDate: string; count: number }

export type EntryStats = {
  currentStreak: number
  longestStreak: number
  last7Days: DayCount[]
  totalEntries: number
}

/** "YYYY-MM-DD" for `date` as seen in `timeZone`. */
export const toLocalDay = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)

/** Moves a "YYYY-MM-DD" day by `days`, with no time zone involved. */
export const shiftDay = (day: string, days: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Pure part of getEntryStats: one row per distinct entryDate in, stats out. */
export function computeEntryStats(rows: DayCount[], timeZone: string, now: Date): EntryStats {
  const countByDay = new Map(rows.map((r) => [r.entryDate, r.count]))
  const today = toLocalDay(now, timeZone)

  // Count back from today, or from yesterday while today is still empty.
  let cursor = countByDay.has(today) ? today : shiftDay(today, -1)
  let currentStreak = 0
  while (countByDay.has(cursor)) {
    currentStreak++
    cursor = shiftDay(cursor, -1)
  }

  let longestStreak = 0
  let run = 0
  let previous: string | undefined
  for (const day of [...countByDay.keys()].sort()) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = day
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const entryDate = shiftDay(today, i - 6)
    return { entryDate, count: countByDay.get(entryDate) ?? 0 }
  })

  const totalEntries = rows.reduce((sum, r) => sum + r.count, 0)

  return { currentStreak, longestStreak, last7Days, totalEntries }
}

/** entryDate comes back as a Date (@db.Date) or a string, depending on the schema. */
export const toDay = (value: Date | string) =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)

export async function getEntryStats(
  db: PrismaClient,
  userId: string,
  { timeZone }: z.infer<typeof entryStatsInput>,
  now = new Date(),
): Promise<EntryStats> {
  const groups = await db.entry.groupBy({
    by: ['entryDate'],
    where: { userId, deletedAt: null },
    _count: { _all: true },
  })

  const rows = groups.map((g) => ({
    entryDate: toDay(g.entryDate),
    count: g._count._all,
  }))

  return computeEntryStats(rows, timeZone, now)
}
