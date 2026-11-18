// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { insightsRouter } from '../index'

const ENTRY_ID = '00000000-0000-4000-8000-000000000001'
const NOW = new Date('2026-11-18T12:00:00.000Z')
const mocks = vi.hoisted(() => ({
  findProfile: vi.fn(),
  findEntries: vi.fn(),
  isStale: vi.fn(),
  remainingEntries: vi.fn(),
  schedule: vi.fn(),
  tryStart: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({
  default: {
    personalityProfile: { findUnique: mocks.findProfile },
    entry: { findMany: mocks.findEntries },
  },
}))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('../services/PersonalityProfileService', () => ({
  personalityProfileService: {
    isStale: mocks.isStale,
    remainingEntries: mocks.remainingEntries,
    tryStart: mocks.tryStart,
  },
}))
vi.mock('../services/schedulePersonalityProfileGeneration', () => ({
  schedulePersonalityProfileGeneration: mocks.schedule,
}))

const createCaller = createCallerFactory(insightsRouter)
function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: `${userId}@example.com`, name: userId },
  } as unknown as TRPCContext)
}
function storedProfile(overrides: Record<string, unknown> = {}) {
  return {
    traits: ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].map(
      (trait, index) => ({
        trait,
        score: 40 + index,
        level: 'Moderate',
        evidenceEntryIds: [ENTRY_ID],
      }),
    ),
    summary: 'Writing patterns are presented as a reflection.',
    meaning: 'This is a starting point for reflection.',
    basedOn: 22,
    generatedAt: NOW,
    generatingAt: null,
    retryAfter: null,
    ...overrides,
  }
}

describe('personality insights API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findProfile.mockResolvedValue(storedProfile())
    mocks.findEntries.mockResolvedValue([{ id: ENTRY_ID }])
    mocks.remainingEntries.mockResolvedValue(0)
    mocks.isStale.mockResolvedValue(false)
    mocks.tryStart.mockResolvedValue({ status: 'not_stale' })
  })

  it('returns a user-scoped safe profile without scheduling fresh work', async () => {
    const result = await callerFor('user-2').personality()

    expect(mocks.findProfile).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-2' } }),
    )
    expect(mocks.findEntries).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-2' }) }),
    )
    expect(result).toMatchObject({ status: 'ready', profile: { traits: expect.any(Array) } })
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('returns a safe aged profile immediately while it schedules its replacement', async () => {
    mocks.isStale.mockResolvedValue(true)
    mocks.tryStart.mockResolvedValue({ status: 'claimed', claimedAt: NOW })

    await expect(callerFor().personality()).resolves.toMatchObject({
      status: 'updating',
      profile: { summary: 'Writing patterns are presented as a reflection.' },
    })
    expect(mocks.schedule).toHaveBeenCalledWith('user-1', NOW)
  })

  it('removes profiles with deleted or unowned evidence and starts only a fenced replacement', async () => {
    mocks.findEntries.mockResolvedValue([])
    mocks.tryStart.mockResolvedValue({
      status: 'cooldown',
      retryAfter: new Date(NOW.getTime() + 300_000),
    })

    await expect(callerFor().personality()).resolves.toMatchObject({
      status: 'ready',
      profile: null,
      unavailable: true,
    })
    expect(mocks.tryStart).toHaveBeenCalledWith('user-1', { forceInvalidProfile: true })
  })

  it('does not expose a profile or schedule AI below the analyzed-entry minimum', async () => {
    mocks.remainingEntries.mockResolvedValue(2)

    await expect(callerFor().personality()).resolves.toMatchObject({
      status: 'notEnoughEntries',
      profile: null,
      remainingEntries: 2,
    })
    expect(mocks.findProfile).not.toHaveBeenCalled()
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    const caller = createCaller({
      headers: new Headers(),
      session: null,
      user: null,
    } as TRPCContext)
    await expect(caller.personality()).rejects.toMatchObject<Partial<TRPCError>>({
      code: 'UNAUTHORIZED',
    })
  })
})
