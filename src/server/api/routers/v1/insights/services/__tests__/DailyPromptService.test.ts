// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DAILY_PROMPT_FAILURE_COOLDOWN_MS,
  claimDay,
  generateDay,
  scheduleDailyPrompt,
} from '../DailyPromptService'

const mocks = vi.hoisted(() => ({
  prisma: {
    entry: { findMany: vi.fn() },
    dailyPrompt: { createMany: vi.fn(), updateMany: vi.fn() },
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

const day = '2026-11-23'
const dayDate = new Date('2026-11-23T00:00:00.000Z')
const claimedAt = new Date('2026-11-23T08:00:00Z')

const analyzedRow = (d: number) => ({
  entryDate: new Date(Date.UTC(2026, 10, d)),
  analysis: { mood: 'calm', moodScore: 60, themes: ['work'], summary: ['A steady day'] },
})

const failure = (lastError: string) => ({
  where: { userId: 'user-1', day: dayDate, generatingAt: claimedAt },
  data: { generatingAt: null, failedAt: expect.any(Date), lastError },
})

describe('DailyPromptService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.dailyPrompt.createMany.mockResolvedValue({ count: 1 })
    mocks.prisma.dailyPrompt.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.entry.findMany.mockResolvedValue([
      analyzedRow(22),
      analyzedRow(21),
      analyzedRow(20),
    ])
  })

  it('claims only an ungenerated day with a free lock and no recent failure', async () => {
    await expect(claimDay('user-1', day, claimedAt)).resolves.toBe(true)

    expect(mocks.prisma.dailyPrompt.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', day: dayDate }],
      skipDuplicates: true,
    })
    const { where } = mocks.prisma.dailyPrompt.updateMany.mock.calls[0]![0]
    expect(where).toMatchObject({ userId: 'user-1', day: dayDate, generatedAt: null })
    expect(where.AND).toContainEqual({
      OR: [
        { failedAt: null },
        { failedAt: { lt: new Date(claimedAt.getTime() - DAILY_PROMPT_FAILURE_COOLDOWN_MS) } },
      ],
    })
  })

  it('reports a lost claim', async () => {
    mocks.prisma.dailyPrompt.updateMany.mockResolvedValue({ count: 0 })
    await expect(claimDay('user-1', day, claimedAt)).resolves.toBe(false)
  })

  it('fails without calling the model when there are too few analyzed entries', async () => {
    mocks.prisma.entry.findMany.mockResolvedValue([analyzedRow(22)])

    await generateDay('user-1', day, claimedAt)

    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.prisma.dailyPrompt.updateMany).toHaveBeenCalledWith(failure('not_enough_entries'))
  })

  it('records a failure when the AI call is blocked', async () => {
    mocks.generate.mockResolvedValue({ tripwire: { reason: 'blocked' } })

    await generateDay('user-1', day, claimedAt)

    expect(mocks.prisma.dailyPrompt.updateMany).toHaveBeenCalledWith(failure('blocked'))
  })

  it('records a failure when the AI call throws', async () => {
    mocks.generate.mockRejectedValue(new Error('timeout'))

    await generateDay('user-1', day, claimedAt)

    expect(mocks.prisma.dailyPrompt.updateMany).toHaveBeenCalledWith(failure('failed'))
  })

  it('records a failure on invalid output', async () => {
    mocks.generate.mockResolvedValue({ object: { prompt: '' } })

    await generateDay('user-1', day, claimedAt)

    expect(mocks.prisma.dailyPrompt.updateMany).toHaveBeenCalledWith(failure('invalid_output'))
  })

  it('stores the cleaned prompt with its source count', async () => {
    mocks.generate.mockResolvedValue({
      object: { prompt: '  What kept   work steady this week? ' },
    })

    await generateDay('user-1', day, claimedAt)

    expect(mocks.generate.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        requestContext: expect.anything(),
        structuredOutput: expect.anything(),
      }),
    )
    expect(mocks.prisma.dailyPrompt.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', day: dayDate, generatingAt: claimedAt },
      data: expect.objectContaining({
        text: 'What kept work steady this week?',
        sourceCount: 3,
        generatedAt: expect.any(Date),
        generatingAt: null,
        lastError: null,
      }),
    })
  })

  it('claims and generates inside after()', async () => {
    mocks.generate.mockResolvedValue({ object: { prompt: 'What felt lighter?' } })

    scheduleDailyPrompt('user-1', day)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    await mocks.after.mock.calls[0]![0]()

    expect(mocks.generate).toHaveBeenCalledTimes(1)
  })
})
