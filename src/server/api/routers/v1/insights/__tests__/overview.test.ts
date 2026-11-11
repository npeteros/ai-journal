// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { insightsRouter } from '../index'

const mocks = vi.hoisted(() => ({
  prisma: {
    entry: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

const createCaller = createCallerFactory(insightsRouter)

function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden' },
  } as unknown as TRPCContext)
}

type Mood = 'calm' | 'grateful' | 'tired' | 'anxious' | 'hard'

function row(entryDate: string, mood: Mood, moodScore: number, themes: string[] = []) {
  return {
    entryDate: new Date(`${entryDate}T00:00:00.000Z`),
    analysis: { mood, moodScore, themes },
  }
}

const NOW = new Date('2026-08-26T12:00:00Z')

type CountArgs = { where: { entryDate?: unknown } }

/** `entry.count` runs twice: once for this month (filtered by entryDate), once for all analyzed. */
function mockCounts({ thisMonth = 0, analyzed = 0 }) {
  mocks.prisma.entry.count.mockImplementation(async ({ where }: CountArgs) =>
    where.entryDate ? thisMonth : analyzed,
  )
}

const monthCountCalls = () =>
  (mocks.prisma.entry.count.mock.calls as [CountArgs][])
    .map(([args]) => args)
    .filter((args) => args.where.entryDate)

function entryDays(...days: string[]) {
  return days.map((day) => ({ entryDate: new Date(`${day}T00:00:00.000Z`), _count: { _all: 1 } }))
}

describe('insights.overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.prisma.entry.findMany.mockResolvedValue([])
    mocks.prisma.entry.groupBy.mockResolvedValue([])
    mockCounts({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires authentication', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null })

    const error = await caller.overview({ timeZone: 'UTC' }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })

  it('rejects an invalid time zone', async () => {
    await expect(callerFor().overview({ timeZone: 'Not/AZone' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })

  it('scopes to the user and excludes soft-deleted entries', async () => {
    await callerFor('user-9').overview({ timeZone: 'UTC' })

    expect(mocks.prisma.entry.findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'user-9',
      deletedAt: null,
      analysis: { isNot: null },
    })
    for (const [args] of mocks.prisma.entry.count.mock.calls) {
      expect(args.where).toMatchObject({ userId: 'user-9', deletedAt: null })
    }
    expect(mocks.prisma.entry.groupBy.mock.calls[0][0].where).toEqual({
      userId: 'user-9',
      deletedAt: null,
    })
  })

  it('only loads analyzed entries from the start of the 6-month trend window', async () => {
    await callerFor().overview({ timeZone: 'UTC' })

    expect(mocks.prisma.entry.findMany.mock.calls[0][0].where.entryDate).toEqual({
      gte: new Date('2026-03-01T00:00:00Z'),
    })
  })

  describe('with no entries', () => {
    it('returns empty aggregates and a full set of null points', async () => {
      const result = await callerFor().overview({ timeZone: 'UTC' })

      expect(result.analyzedCount).toBe(0)
      expect(result.entriesThisMonth).toBe(0)
      expect(result.currentStreak).toBe(0)
      expect(result.moodMix).toEqual([])
      expect(result.topThemes).toEqual([])
      expect(result.moodThisWeek.map((p) => p.date)).toEqual([
        '2026-08-20',
        '2026-08-21',
        '2026-08-22',
        '2026-08-23',
        '2026-08-24',
        '2026-08-25',
        '2026-08-26',
      ])
      expect(result.moodThisWeek.every((p) => p.value === null)).toBe(true)
      expect(result.emotionalTrend.map((p) => p.month)).toEqual([
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
      ])
      expect(result.emotionalTrend.every((p) => p.value === null)).toBe(true)
    })
  })

  describe('with entries but no analysis', () => {
    it('counts them this month but leaves every chart empty', async () => {
      mockCounts({ thisMonth: 5 })

      const result = await callerFor().overview({ timeZone: 'UTC' })

      expect(result.entriesThisMonth).toBe(5)
      expect(result.analyzedCount).toBe(0)
      expect(result.moodThisWeek.every((p) => p.value === null)).toBe(true)
      expect(result.topThemes).toEqual([])
    })
  })

  describe('with a mix of moods', () => {
    beforeEach(() => {
      mockCounts({ thisMonth: 6, analyzed: 6 })
      mocks.prisma.entry.findMany.mockResolvedValue([
        row('2026-08-26', 'calm', 80, ['Work', 'Gratitude']),
        row('2026-08-26', 'tired', 40, ['work']),
        row('2026-08-24', 'calm', 70, ['Work', 'Work', 'Family']),
        row('2026-08-10', 'anxious', 30, ['Family']),
        row('2026-07-30', 'grateful', 90, ['Gratitude']),
        row('2026-03-02', 'hard', 20, []),
      ])
    })

    it('averages mood scores per day and leaves days without analysis null', async () => {
      const { moodThisWeek } = await callerFor().overview({ timeZone: 'UTC' })

      expect(moodThisWeek).toEqual([
        { date: '2026-08-20', value: null },
        { date: '2026-08-21', value: null },
        { date: '2026-08-22', value: null },
        { date: '2026-08-23', value: null },
        { date: '2026-08-24', value: 70 },
        { date: '2026-08-25', value: null },
        { date: '2026-08-26', value: 60 },
      ])
    })

    it('averages mood scores per month for the last 6 months', async () => {
      const { emotionalTrend } = await callerFor().overview({ timeZone: 'UTC' })

      expect(emotionalTrend).toEqual([
        { month: '2026-03', value: 20 },
        { month: '2026-04', value: null },
        { month: '2026-05', value: null },
        { month: '2026-06', value: null },
        { month: '2026-07', value: 90 },
        { month: '2026-08', value: 55 },
      ])
    })

    it('counts entries per mood over the last 30 days, most common first', async () => {
      const { moodMix } = await callerFor().overview({ timeZone: 'UTC' })

      // The 'hard' entry from March is outside the 30-day window.
      expect(moodMix).toEqual([
        { mood: 'calm', count: 2 },
        { mood: 'anxious', count: 1 },
        { mood: 'grateful', count: 1 },
        { mood: 'tired', count: 1 },
      ])
    })

    it('shares each theme across the last 30 days, counting an entry once and ignoring case', async () => {
      const { topThemes } = await callerFor().overview({ timeZone: 'UTC' })

      // 5 analyzed entries in the window: Work in 3, Family in 2, Gratitude in 2
      expect(topThemes).toEqual([
        { label: 'Work', pct: 60 },
        { label: 'Family', pct: 40 },
        { label: 'Gratitude', pct: 40 },
      ])
    })

    it('reports the entry and analyzed counts', async () => {
      const result = await callerFor().overview({ timeZone: 'UTC' })

      expect(result.entriesThisMonth).toBe(6)
      expect(result.analyzedCount).toBe(6)
    })
  })

  describe('recent window', () => {
    it('includes day 30 (Jul 28) and excludes day 31 (Jul 27)', async () => {
      mocks.prisma.entry.findMany.mockResolvedValue([
        row('2026-07-28', 'calm', 70, ['Inside']),
        row('2026-07-27', 'hard', 20, ['Outside']),
      ])

      const { moodMix, topThemes } = await callerFor().overview({ timeZone: 'UTC' })

      expect(moodMix).toEqual([{ mood: 'calm', count: 1 }])
      expect(topThemes).toEqual([{ label: 'Inside', pct: 100 }])
    })

    it('keeps older entries in the 6-month trend', async () => {
      mocks.prisma.entry.findMany.mockResolvedValue([row('2026-07-01', 'hard', 20, ['Old'])])

      const { emotionalTrend, topThemes } = await callerFor().overview({ timeZone: 'UTC' })

      expect(emotionalTrend.find((p) => p.month === '2026-07')?.value).toBe(20)
      expect(topThemes).toEqual([])
    })
  })

  describe('theme labels', () => {
    it('shows the most frequent casing', async () => {
      mocks.prisma.entry.findMany.mockResolvedValue([
        row('2026-08-24', 'calm', 70, ['Work']),
        row('2026-08-25', 'calm', 70, ['work']),
        row('2026-08-26', 'calm', 70, ['work']),
      ])

      const { topThemes } = await callerFor().overview({ timeZone: 'UTC' })

      expect(topThemes).toEqual([{ label: 'work', pct: 100 }])
    })

    it('breaks casing ties the same way whatever the row order', async () => {
      const rows = [
        row('2026-08-25', 'calm', 70, ['work']),
        row('2026-08-26', 'calm', 70, ['Work']),
      ]

      mocks.prisma.entry.findMany.mockResolvedValue(rows)
      const first = await callerFor().overview({ timeZone: 'UTC' })
      mocks.prisma.entry.findMany.mockResolvedValue([...rows].reverse())
      const second = await callerFor().overview({ timeZone: 'UTC' })

      expect(first.topThemes).toEqual([{ label: 'Work', pct: 100 }])
      expect(second.topThemes).toEqual(first.topThemes)
    })
  })

  describe('streak', () => {
    it('counts consecutive days with an entry ending today', async () => {
      mocks.prisma.entry.groupBy.mockResolvedValue(
        entryDays('2026-08-26', '2026-08-25', '2026-08-24', '2026-08-22'),
      )

      const { currentStreak } = await callerFor().overview({ timeZone: 'UTC' })

      expect(currentStreak).toBe(3)
    })

    it('keeps the streak alive from yesterday while today is still empty', async () => {
      mocks.prisma.entry.groupBy.mockResolvedValue(entryDays('2026-08-25', '2026-08-24'))

      const { currentStreak } = await callerFor().overview({ timeZone: 'UTC' })

      expect(currentStreak).toBe(2)
    })
  })

  it('returns at most 5 themes', async () => {
    mocks.prisma.entry.findMany.mockResolvedValue([
      row('2026-08-26', 'calm', 80, ['a', 'b', 'c', 'd', 'e', 'f', 'g']),
    ])

    const { topThemes } = await callerFor().overview({ timeZone: 'UTC' })

    expect(topThemes).toHaveLength(5)
  })

  describe('month and day boundaries', () => {
    it('uses the user time zone for "today" and the current month', async () => {
      // 17:00 UTC on Oct 31 is already Nov 1 in Manila (UTC+8) but still Oct 31 in UTC.
      vi.setSystemTime(new Date('2026-10-31T17:00:00Z'))

      const manila = await callerFor().overview({ timeZone: 'Asia/Manila' })
      expect(manila.moodThisWeek.at(-1)?.date).toBe('2026-11-01')
      expect(manila.emotionalTrend.at(-1)?.month).toBe('2026-11')
      expect(monthCountCalls()[0].where.entryDate).toEqual({
        gte: new Date('2026-11-01T00:00:00Z'),
        lt: new Date('2026-12-01T00:00:00Z'),
      })

      const utc = await callerFor().overview({ timeZone: 'UTC' })
      expect(utc.moodThisWeek.at(-1)?.date).toBe('2026-10-31')
      expect(utc.emotionalTrend.at(-1)?.month).toBe('2026-10')
      expect(monthCountCalls()[1].where.entryDate).toEqual({
        gte: new Date('2026-10-01T00:00:00Z'),
        lt: new Date('2026-11-01T00:00:00Z'),
      })
    })

    it('puts the last day of a month in that month and the next day in the next', async () => {
      vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
      mocks.prisma.entry.findMany.mockResolvedValue([
        row('2026-08-31', 'calm', 60),
        row('2026-09-01', 'calm', 80),
      ])

      const { emotionalTrend, moodThisWeek } = await callerFor().overview({ timeZone: 'UTC' })

      expect(emotionalTrend.slice(-2)).toEqual([
        { month: '2026-08', value: 60 },
        { month: '2026-09', value: 80 },
      ])
      expect(moodThisWeek.find((p) => p.date === '2026-08-31')?.value).toBe(60)
      expect(moodThisWeek.find((p) => p.date === '2026-09-01')?.value).toBe(80)
    })

    it('rolls the 6-month window back across a year boundary', async () => {
      vi.setSystemTime(new Date('2027-02-10T12:00:00Z'))

      const { emotionalTrend } = await callerFor().overview({ timeZone: 'UTC' })

      expect(emotionalTrend.map((p) => p.month)).toEqual([
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
        '2027-01',
        '2027-02',
      ])
    })
  })
})
