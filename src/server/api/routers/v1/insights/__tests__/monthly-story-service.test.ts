// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MONTHLY_STORY_FAILURE_COOLDOWN_MS,
  claimMonth,
  generateMonth,
  sampleAcrossMonth,
  scheduleMonthlyStories,
  type MissingMonthlyStory,
} from '../services/MonthlyStoryService'

const mocks = vi.hoisted(() => ({
  prisma: {
    entry: { findMany: vi.fn() },
    monthlyStory: { createMany: vi.fn(), updateMany: vi.fn() },
  },
  generate: vi.fn(),
  after: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/src/mastra', () => ({
  mastra: { getAgentById: () => ({ generate: mocks.generate }) },
}))
vi.mock('@/src/mastra/observability', () => ({ logger: { warn: vi.fn() } }))

const story: MissingMonthlyStory = {
  month: '2026-07',
  mood: 'calm',
  entryCount: 3,
  fingerprint: '3:2026-07-30T00:00:00.000Z',
}
const claimedAt = new Date('2026-08-26T12:00:00Z')

const analyzedRow = (day: number) => ({
  entryDate: new Date(Date.UTC(2026, 6, day)),
  analysis: { mood: 'calm', moodScore: 60, themes: ['work'], summary: ['A steady day'] },
})

describe('MonthlyStoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.monthlyStory.createMany.mockResolvedValue({ count: 1 })
    mocks.prisma.monthlyStory.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.entry.findMany.mockResolvedValue([analyzedRow(1), analyzedRow(2)])
  })

  it('does not claim a month that failed within the cooldown', async () => {
    await claimMonth('user-1', story, claimedAt)

    const { where } = mocks.prisma.monthlyStory.updateMany.mock.calls[0]![0]
    expect(where.AND).toContainEqual({
      OR: [
        { failedAt: null },
        { failedAt: { lt: new Date(claimedAt.getTime() - MONTHLY_STORY_FAILURE_COOLDOWN_MS) } },
      ],
    })
    expect(where.AND).toContainEqual({
      OR: [
        { generatedAt: null },
        { fingerprint: null },
        { fingerprint: { not: story.fingerprint } },
      ],
    })
  })

  it('records a failure when the AI call is blocked', async () => {
    mocks.generate.mockResolvedValue({ tripwire: { reason: 'blocked' } })

    await generateMonth('user-1', story, claimedAt)

    expect(mocks.prisma.monthlyStory.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', month: '2026-07', generatingAt: claimedAt },
      data: { generatingAt: null, failedAt: expect.any(Date), lastError: 'blocked' },
    })
  })

  it('records a failure when the AI call throws', async () => {
    mocks.generate.mockRejectedValue(new Error('timeout'))

    await generateMonth('user-1', story, claimedAt)

    expect(mocks.prisma.monthlyStory.updateMany.mock.calls[0]![0].data).toMatchObject({
      failedAt: expect.any(Date),
      lastError: 'failed',
    })
  })

  it('saves the summary with the fingerprint and the real entry count in the prompt', async () => {
    mocks.generate.mockResolvedValue({ object: { summary: 'with a steady stretch at work.' } })

    await generateMonth('user-1', story, claimedAt)

    expect(mocks.generate.mock.calls[0]![0]).toContain('"3 entries · mostly calm"')
    expect(mocks.prisma.monthlyStory.updateMany.mock.calls[0]![0].data).toMatchObject({
      summary: 'with a steady stretch at work',
      fingerprint: story.fingerprint,
      failedAt: null,
    })
  })

  it('samples entries evenly across the month', () => {
    const days = Array.from({ length: 100 }, (_, i) => i)
    const sample = sampleAcrossMonth(days, 4)
    expect(sample).toEqual([0, 25, 50, 75])
    expect(sampleAcrossMonth([1, 2], 4)).toEqual([1, 2])
  })

  it('runs at most two generations, one after another', async () => {
    mocks.generate.mockResolvedValue({ object: { summary: 'with a steady stretch' } })
    const months = ['2026-07', '2026-06', '2026-05'].map((month) => ({ ...story, month }))

    scheduleMonthlyStories('user-1', months)
    await mocks.after.mock.calls[0]![0]()

    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.generate).toHaveBeenCalledTimes(2)
  })
})
