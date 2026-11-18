// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { mainMood, monthFingerprint, openingSentence, pickQuoteEntry } from '../core/queries/story'
import { insightsRouter } from '../index'

const mocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    entry: { findMany: vi.fn() },
    monthlyStory: { findMany: vi.fn() },
  },
  scheduleMonthlyStories: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('../services/MonthlyStoryService', () => ({
  MONTHLY_STORY_MAX_GENERATIONS_PER_REQUEST: 2,
  scheduleMonthlyStories: mocks.scheduleMonthlyStories,
}))
vi.mock('../services/scheduleInsightReportGeneration', () => ({
  scheduleInsightReportGeneration: vi.fn(),
}))

const createCaller = createCallerFactory(insightsRouter)

function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden' },
  } as unknown as TRPCContext)
}

type Mood = 'calm' | 'grateful' | 'tired' | 'anxious' | 'hard'

const NOW = new Date('2026-08-26T12:00:00Z')

function entry(
  id: string,
  day: string,
  analysis: { mood: Mood; moodScore: number } | null,
  writtenAt = `${day}T09:00:00Z`,
) {
  return {
    id,
    title: `Title ${id}`,
    entryDate: new Date(`${day}T00:00:00Z`),
    writtenAt: new Date(writtenAt),
    updatedAt: new Date(writtenAt),
    analysis: analysis && { ...analysis, analyzedAt: new Date(writtenAt) },
  }
}

function mockEntries(rows: ReturnType<typeof entry>[], bodies: Record<string, string> = {}) {
  mocks.prisma.$queryRaw.mockResolvedValue(
    [...new Set(rows.map((r) => r.entryDate.toISOString().slice(0, 7)))]
      .sort()
      .reverse()
      .slice(0, 7)
      .map((month) => ({ month })),
  )
  mocks.prisma.entry.findMany.mockImplementation(
    async ({ where }: { where: { id?: { in: string[] }; NOT?: unknown } }) =>
      where.id
        ? where.id.in.map((id) => ({ id, body: bodies[id] ?? `Body of ${id}.` }))
        : where.NOT
          ? rows.filter(({ id }) => bodies[id] !== '').map(({ id }) => ({ id }))
          : [...rows].sort(
              (a, b) =>
                b.entryDate.getTime() - a.entryDate.getTime() ||
                b.writtenAt.getTime() - a.writtenAt.getTime(),
            ),
  )
}

describe('insights.story', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.prisma.monthlyStory.findMany.mockResolvedValue([])
    mockEntries([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires authentication', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null })

    const error = await caller.story({ timeZone: 'UTC' }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })

  it('returns an empty page without entries', async () => {
    await expect(callerFor().story({ timeZone: 'UTC' })).resolves.toEqual({
      months: [],
      highlight: null,
      nextCursor: null,
      currentMonth: '2026-08',
    })
    expect(mocks.scheduleMonthlyStories).not.toHaveBeenCalled()
  })

  it('groups entries by month, newest first, skipping empty months', async () => {
    mockEntries([
      entry('a', '2026-08-03', { mood: 'calm', moodScore: 60 }),
      entry('b', '2026-06-10', { mood: 'hard', moodScore: 20 }),
      entry('c', '2026-06-12', { mood: 'hard', moodScore: 30 }),
      entry('d', '2026-06-20', { mood: 'grateful', moodScore: 80 }),
    ])

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(
      page.months.map(({ month, entryCount, mood, finished }) => ({
        month,
        entryCount,
        mood,
        finished,
      })),
    ).toEqual([
      { month: '2026-08', entryCount: 1, mood: 'calm', finished: false },
      { month: '2026-06', entryCount: 3, mood: 'hard', finished: true },
    ])
  })

  it('only queries live entries owned by the caller', async () => {
    mockEntries([entry('a', '2026-07-03', { mood: 'calm', moodScore: 60 })])

    await callerFor('user-9').story({ timeZone: 'UTC' })

    for (const [args] of mocks.prisma.entry.findMany.mock.calls as [
      { where: { userId: string; deletedAt: null } },
    ][]) {
      expect(args.where).toMatchObject({ userId: 'user-9', deletedAt: null })
    }
    const [sql, ...values] = mocks.prisma.$queryRaw.mock.calls[0]!
    expect(sql.join('?')).toMatch(/"deletedAt" IS NULL[\s\S]*LIMIT/)
    expect(values).toContain('user-9')
  })

  it('highlights the best quote of the most recent finished month', async () => {
    mockEntries(
      [
        entry('now', '2026-08-03', { mood: 'calm', moodScore: 99 }),
        entry('low', '2026-07-03', { mood: 'calm', moodScore: 40 }),
        entry('high', '2026-07-09', { mood: 'calm', moodScore: 85 }),
      ],
      { high: 'Slept in and felt rested. Then a long walk.' },
    )

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(page.highlight).toEqual({
      entryId: 'high',
      text: 'Slept in and felt rested.',
      title: 'Title high',
      date: '2026-07-09',
    })
  })

  it('uses the stored AI summary and schedules only missing finished months', async () => {
    const june = entry('c', '2026-06-03', { mood: 'calm', moodScore: 40 })
    const july = entry('b', '2026-07-03', { mood: 'tired', moodScore: 40 })
    mockEntries([
      entry('a', '2026-08-03', { mood: 'calm', moodScore: 60 }),
      july,
      june,
      entry('d', '2026-05-03', null),
    ])
    mocks.prisma.monthlyStory.findMany.mockResolvedValue([
      {
        month: '2026-06',
        summary: 'with a steady stretch of quiet mornings',
        fingerprint: monthFingerprint([june]),
      },
    ])

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(page.months.map(({ month, summary }) => [month, summary])).toEqual([
      ['2026-08', null],
      ['2026-07', null],
      ['2026-06', 'with a steady stretch of quiet mornings'],
      ['2026-05', null],
    ])
    expect(mocks.scheduleMonthlyStories).toHaveBeenCalledWith('user-1', [
      { month: '2026-07', mood: 'tired', entryCount: 1, fingerprint: monthFingerprint([july]) },
    ])
  })

  it('hides and regenerates a summary when the month changed since it was written', async () => {
    const june = entry('c', '2026-06-03', { mood: 'calm', moodScore: 40 })
    mockEntries([june, entry('e', '2026-06-09', { mood: 'calm', moodScore: 50 })])
    mocks.prisma.monthlyStory.findMany.mockResolvedValue([
      { month: '2026-06', summary: 'old text', fingerprint: monthFingerprint([june]) },
    ])

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(page.months[0]?.summary).toBeNull()
    expect(mocks.scheduleMonthlyStories.mock.calls[0]?.[1]).toHaveLength(1)
  })

  it('schedules at most two months per request', async () => {
    mockEntries(
      ['2026-07-03', '2026-06-03', '2026-05-03', '2026-04-03'].map((day, i) =>
        entry(`e${i}`, day, { mood: 'calm', moodScore: 50 }),
      ),
    )

    await callerFor().story({ timeZone: 'UTC' })

    expect(
      mocks.scheduleMonthlyStories.mock.calls[0]?.[1].map(({ month }: { month: string }) => month),
    ).toEqual(['2026-07', '2026-06'])
  })

  it('skips entries with an empty body when choosing the quote', async () => {
    mockEntries(
      [
        entry('blank', '2026-07-03', { mood: 'calm', moodScore: 90 }),
        entry('text', '2026-07-04', { mood: 'calm', moodScore: 40 }),
      ],
      { blank: '', text: 'Long walk by the river.' },
    )

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(page.highlight).toMatchObject({ entryId: 'text', text: 'Long walk by the river.' })
  })

  it('quotes the title when the chosen entry has no body text', async () => {
    mockEntries([entry('t', '2026-07-03', { mood: 'calm', moodScore: 90 })], { t: '   ' })

    const page = await callerFor().story({ timeZone: 'UTC' })

    expect(page.highlight?.text).toBe('Title t')
  })

  it('treats the current month by the requested time zone', async () => {
    vi.setSystemTime(new Date('2026-08-31T20:00:00Z'))
    mockEntries([entry('a', '2026-08-31', { mood: 'calm', moodScore: 60 })])

    const manila = await callerFor().story({ timeZone: 'Asia/Manila' })
    const utc = await callerFor().story({ timeZone: 'UTC' })

    expect(manila.months[0]?.finished).toBe(true)
    expect(utc.months[0]?.finished).toBe(false)
  })

  it('pages older months with a month cursor', async () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      entry(`e${i}`, `2026-0${8 - i}-05`, { mood: 'calm', moodScore: 50 }),
    )
    mockEntries(rows)

    const first = await callerFor().story({ timeZone: 'UTC' })

    expect(first.months).toHaveLength(6)
    expect(first.nextCursor).toBe('2026-03')

    await callerFor().story({ timeZone: 'UTC', cursor: '2026-03' })

    expect(JSON.stringify(mocks.prisma.$queryRaw.mock.calls[1])).toContain(
      '2026-03-01T00:00:00.000Z',
    )
  })

  it('rejects a malformed cursor', async () => {
    await expect(callerFor().story({ timeZone: 'UTC', cursor: '2026-13' })).rejects.toThrow()
  })
})

describe('mainMood', () => {
  const rows = (...moods: (Mood | null)[]) =>
    moods.map((mood) => ({ analysis: mood ? { mood, moodScore: 50 } : null }))

  it('picks the most common analyzed mood', () => {
    expect(mainMood(rows('tired', 'calm', 'tired', null, null))).toBe('tired')
  })

  it('breaks ties alphabetically', () => {
    expect(mainMood(rows('tired', 'calm', 'tired', 'calm'))).toBe('calm')
  })

  it('is null when nothing is analyzed', () => {
    expect(mainMood(rows(null, null))).toBeNull()
  })
})

describe('pickQuoteEntry', () => {
  it('prefers the highest mood score, then the newest', () => {
    const picked = pickQuoteEntry([
      entry('old', '2026-07-01', { mood: 'calm', moodScore: 80 }),
      entry('new', '2026-07-02', { mood: 'calm', moodScore: 80 }),
      entry('low', '2026-07-03', { mood: 'calm', moodScore: 10 }),
    ])
    expect(picked.id).toBe('new')
  })

  it('falls back to the newest entry when none is analyzed', () => {
    const picked = pickQuoteEntry([entry('a', '2026-07-01', null), entry('b', '2026-07-04', null)])
    expect(picked.id).toBe('b')
  })
})

describe('openingSentence', () => {
  it('keeps only the first sentence', () => {
    expect(openingSentence('Good day!  Lots   happened. More')).toBe('Good day!')
  })

  it('cuts long sentences at a word boundary', () => {
    const text = openingSentence(`${'word '.repeat(40)}end.`, 30)
    expect(text.length).toBeLessThanOrEqual(30)
    expect(text).toBe('word word word word word word…')
  })
})
