// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auth } from '@/src/server/auth/auth'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { profileRouter } from '../index'

const NOW = new Date('2026-11-23T12:00:00.000Z')
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({
  default: { userProfile: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

const createCaller = createCallerFactory(profileRouter)
function callerFor(userId = 'user-1') {
  const ctx = {
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: `${userId}@example.com`, name: userId },
  } as unknown as TRPCContext
  // Mutations look the session up again without the cookie cache; keep it signed in.
  vi.mocked(auth.api.getSession).mockResolvedValue({
    session: ctx.session,
    user: ctx.user,
  } as never)
  return createCaller(ctx)
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    focusAreas: [],
    focusAreaOther: null,
    goal: null,
    currentContext: null,
    preferredTone: null,
    welcomeAnsweredAt: null,
    welcomeSkippedAt: null,
    tourCompletedAt: null,
    tourDismissedAt: null,
    ...overrides,
  }
}

describe('profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    mocks.upsert.mockImplementation(({ create }) => Promise.resolve(row(create)))
  })

  describe('get', () => {
    it('shows the welcome card to a user with no profile row', async () => {
      mocks.findUnique.mockResolvedValue(null)
      const result = await callerFor().get()
      expect(result.onboarding).toEqual({ showWelcome: true, showTour: false })
      expect(result.answers.focusAreas).toEqual([])
      expect(mocks.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      )
    })

    it('shows the tour once the welcome card is handled', async () => {
      mocks.findUnique.mockResolvedValue(row({ welcomeSkippedAt: NOW }))
      expect((await callerFor().get()).onboarding).toEqual({ showWelcome: false, showTour: true })
    })

    it('shows nothing once the tour is dismissed', async () => {
      mocks.findUnique.mockResolvedValue(row({ welcomeAnsweredAt: NOW, tourDismissedAt: NOW }))
      expect((await callerFor().get()).onboarding).toEqual({ showWelcome: false, showTour: false })
    })

    it('drops focus area ids that are no longer offered', async () => {
      mocks.findUnique.mockResolvedValue(row({ focusAreas: ['stress', 'retired-id'] }))
      expect((await callerFor().get()).answers.focusAreas).toEqual(['stress'])
    })
  })

  describe('saveAbout', () => {
    it('trims answers, clears skipped ones, and marks the welcome answered', async () => {
      const result = await callerFor().saveAbout({
        focusAreas: ['stress', 'stress', 'work'],
        focusAreaOther: '   ',
        goal: '  Handle stress better  ',
        currentContext: '',
        preferredTone: 'DIRECT',
      })

      const data = {
        focusAreas: ['stress', 'work'],
        focusAreaOther: null,
        goal: 'Handle stress better',
        currentContext: null,
        preferredTone: 'DIRECT',
        welcomeAnsweredAt: NOW,
      }
      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: { userId: 'user-1', ...data },
          update: data,
        }),
      )
      expect(result.onboarding).toEqual({ showWelcome: false, showTour: true })
    })

    it.each([
      ['more than 3 focus areas', { focusAreas: ['stress', 'work', 'health', 'gratitude'] }],
      ['an unknown focus area', { focusAreas: ['astrology'] }],
      ['a goal over 280 characters', { focusAreas: [], goal: 'a'.repeat(281) }],
      ['context over 500 characters', { focusAreas: [], currentContext: 'a'.repeat(501) }],
      ['an unknown tone', { focusAreas: [], preferredTone: 'SARCASTIC' }],
    ])('rejects %s', async (_label, input) => {
      await expect(callerFor().saveAbout(input as never)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
      expect(mocks.upsert).not.toHaveBeenCalled()
    })
  })

  it('skipWelcome records the skip and moves on to the tour', async () => {
    const result = await callerFor().skipWelcome()
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { welcomeSkippedAt: NOW } }),
    )
    expect(result).toEqual({ showWelcome: false, showTour: true })
  })

  it.each([
    ['completed', 'tourCompletedAt'],
    ['dismissed', 'tourDismissedAt'],
  ] as const)('finishTour %s sets %s', async (outcome, field) => {
    await callerFor().finishTour({ outcome })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { [field]: NOW } }))
  })

  it('replayTour clears the tour outcome without deleting anything', async () => {
    const result = await callerFor().replayTour()
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { welcomeSkippedAt: NOW, tourCompletedAt: null, tourDismissedAt: null },
      }),
    )
    expect(result).toEqual({ showWelcome: false, showTour: true })
  })
})
