import { describe, expect, it } from 'vitest'

import { computeEntryStats, type DayCount } from '../core/queries/stats'

const NOW = new Date('2026-03-10T12:00:00Z')
const days = (...entryDates: string[]): DayCount[] =>
  entryDates.map((entryDate) => ({ entryDate, count: 1 }))

describe('computeEntryStats', () => {
  it('returns zeros and an empty week when there are no entries', () => {
    const stats = computeEntryStats([], 'UTC', NOW)

    expect(stats.currentStreak).toBe(0)
    expect(stats.longestStreak).toBe(0)
    expect(stats.totalEntries).toBe(0)
    expect(stats.last7Days).toHaveLength(7)
    expect(stats.last7Days.every((d) => d.count === 0)).toBe(true)
    expect(stats.last7Days[0]?.entryDate).toBe('2026-03-04')
    expect(stats.last7Days[6]?.entryDate).toBe('2026-03-10')
  })

  it("keeps the streak alive before today's entry", () => {
    const stats = computeEntryStats(days('2026-03-08', '2026-03-09'), 'UTC', NOW)

    expect(stats.currentStreak).toBe(2)
  })

  it('counts today when it has an entry', () => {
    const stats = computeEntryStats(days('2026-03-09', '2026-03-10'), 'UTC', NOW)

    expect(stats.currentStreak).toBe(2)
  })

  it('resets the current streak after a missed day but keeps the longest', () => {
    const stats = computeEntryStats(days('2026-03-04', '2026-03-05', '2026-03-06'), 'UTC', NOW)

    expect(stats.currentStreak).toBe(0)
    expect(stats.longestStreak).toBe(3)
  })

  it('counts a backdated entry on the day it is dated, bridging a gap', () => {
    const withGap = days('2026-03-08', '2026-03-10')
    const backdated = days('2026-03-08', '2026-03-09', '2026-03-10')

    expect(computeEntryStats(withGap, 'UTC', NOW).currentStreak).toBe(1)
    expect(computeEntryStats(backdated, 'UTC', NOW).currentStreak).toBe(3)
  })

  it('counts several entries on one day as one streak day', () => {
    const stats = computeEntryStats([{ entryDate: '2026-03-10', count: 3 }], 'UTC', NOW)

    expect(stats.currentStreak).toBe(1)
    expect(stats.longestStreak).toBe(1)
    expect(stats.totalEntries).toBe(3)
    expect(stats.last7Days[6]).toEqual({ entryDate: '2026-03-10', count: 3 })
  })

  it('works out today in a time zone ahead of UTC', () => {
    // 20:00 UTC on 10 March is already 11 March in Tokyo.
    const lateEvening = new Date('2026-03-10T20:00:00Z')
    const rows = days('2026-03-09')

    const utc = computeEntryStats(rows, 'UTC', lateEvening)
    const tokyo = computeEntryStats(rows, 'Asia/Tokyo', lateEvening)

    expect(utc.last7Days[6]?.entryDate).toBe('2026-03-10')
    expect(utc.currentStreak).toBe(1)
    expect(tokyo.last7Days[6]?.entryDate).toBe('2026-03-11')
    expect(tokyo.currentStreak).toBe(0)
  })
})
