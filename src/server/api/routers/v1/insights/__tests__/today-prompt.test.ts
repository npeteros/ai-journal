// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_PROMPT_SOURCE, starterPrompt } from '@/src/lib/daily-prompt-starters'
import { getTodayPrompt } from '../core/queries/todayPrompt'

const mocks = vi.hoisted(() => ({
  prisma: {
    dailyPrompt: { findUnique: vi.fn() },
    entryAnalysis: { count: vi.fn() },
  },
  schedule: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('../services/DailyPromptService', () => ({
  DAILY_PROMPT_MIN_ANALYZED_ENTRIES: 3,
  scheduleDailyPrompt: mocks.schedule,
}))

// 23:30 UTC on Nov 22 is already Nov 23 in Manila.
const now = new Date('2026-11-22T23:30:00Z')
const input = { timeZone: 'Asia/Manila' }

describe('getTodayPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.dailyPrompt.findUnique.mockResolvedValue(null)
    mocks.prisma.entryAnalysis.count.mockResolvedValue(5)
  })

  it('returns the stored AI prompt for the local day', async () => {
    mocks.prisma.dailyPrompt.findUnique.mockResolvedValue({
      text: 'What made space for slower mornings?',
      sourceCount: 6,
      generatedAt: new Date(),
    })

    await expect(getTodayPrompt('user-1', input, now)).resolves.toEqual({
      text: 'What made space for slower mornings?',
      source: 'From your last 6 entries',
      kind: 'ai',
    })
    expect(mocks.prisma.dailyPrompt.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_day: { userId: 'user-1', day: new Date('2026-11-23T00:00:00.000Z') } },
      }),
    )
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('returns a starter and schedules generation when today has no prompt yet', async () => {
    await expect(getTodayPrompt('user-1', input, now)).resolves.toEqual({
      text: starterPrompt('2026-11-23'),
      source: STARTER_PROMPT_SOURCE,
      kind: 'starter',
    })
    expect(mocks.schedule).toHaveBeenCalledWith('user-1', '2026-11-23')
  })

  it('does not schedule below the analyzed-entry threshold', async () => {
    mocks.prisma.entryAnalysis.count.mockResolvedValue(2)

    const result = await getTodayPrompt('user-1', input, now)

    expect(result.kind).toBe('starter')
    expect(mocks.schedule).not.toHaveBeenCalled()
  })
})
