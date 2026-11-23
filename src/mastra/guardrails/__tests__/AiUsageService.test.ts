// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import {
  AiUsageService,
  DAILY_PROMPT_AGENT,
  MONTHLY_STORY_AGENT,
  VOICE_SESSION_AGENT,
  VOICE_SESSION_MODEL,
  type AiUsageOutcome,
  type AiUsageReservation,
} from '../AiUsageService'

// Keep the real Prisma client and Mastra observability out of unit tests.
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('../../observability', () => ({ logger: {} }))

const NOW = new Date('2026-10-30T12:00:00.000Z')

const reservation: AiUsageReservation = {
  userId: 'user-1',
  agent: 'journal-companion-agent',
  model: 'openai/gpt-5-mini',
}

const outcome: AiUsageOutcome = {
  model: 'openai/gpt-5-mini',
  inputTokens: 120,
  outputTokens: 45,
  latencyMs: 830,
  success: true,
}

function setup() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    aiUsageLog: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'usage-1' }),
    },
  }
  const db = {
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    aiUsageLog: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
  const log = { error: vi.fn() }
  const service = new AiUsageService(
    db as unknown as ConstructorParameters<typeof AiUsageService>[0],
    log as unknown as IMastraLogger,
  )
  return { db, tx, log, service }
}

describe('AiUsageService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  describe('reserve', () => {
    it('inserts a pending row and returns its ID when under the limit', async () => {
      vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '5')
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(4)

      await expect(service.reserve(reservation)).resolves.toBe('usage-1')
      expect(tx.aiUsageLog.create).toHaveBeenCalledWith({
        data: {
          ...reservation,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          success: false,
        },
        select: { id: true },
      })
    })

    it('takes the per-user lock before counting', async () => {
      const { tx, service } = setup()

      await service.reserve(reservation)

      expect(tx.$executeRaw).toHaveBeenCalledOnce()
      expect(tx.$executeRaw.mock.calls[0]).toContain('user-1')
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.aiUsageLog.count.mock.invocationCallOrder[0],
      )
    })

    it.each([5, 6])(
      'throws TOO_MANY_REQUESTS without inserting when count is %i with a limit of 5',
      async (count) => {
        vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '5')
        const { tx, service } = setup()
        tx.aiUsageLog.count.mockResolvedValue(count)

        const result = service.reserve(reservation)

        await expect(result).rejects.toBeInstanceOf(TRPCError)
        await expect(result).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
        expect(tx.aiUsageLog.create).not.toHaveBeenCalled()
      },
    )

    it('counts only rows inside the window', async () => {
      vi.stubEnv('AI_RATE_LIMIT_WINDOW_SECONDS', '600')
      const { tx, service } = setup()

      await service.reserve(reservation)

      const { where } = tx.aiUsageLog.count.mock.calls[0][0]
      expect(where.createdAt).toEqual({ gte: new Date(NOW.getTime() - 600 * 1000) })
    })

    it('counts only rows for the specified user', async () => {
      const { tx, service } = setup()

      await service.reserve({ ...reservation, userId: 'user-42' })

      const { where } = tx.aiUsageLog.count.mock.calls[0][0]
      expect(where.userId).toBe('user-42')
    })

    it('leaves voice session, monthly story and daily prompt rows out of the shared count', async () => {
      const { tx, service } = setup()

      await service.reserve(reservation)

      const { where } = tx.aiUsageLog.count.mock.calls[0][0]
      expect(where.agent).toEqual({
        notIn: [VOICE_SESSION_AGENT, MONTHLY_STORY_AGENT, DAILY_PROMPT_AGENT],
      })
    })

    it('counts monthly story calls against their own budget only', async () => {
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(20)

      await expect(
        service.reserve({ ...reservation, agent: MONTHLY_STORY_AGENT }),
      ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })

      const { where } = tx.aiUsageLog.count.mock.calls[0][0]
      expect(where.agent).toBe(MONTHLY_STORY_AGENT)
    })

    it('counts daily prompt calls against their own budget only', async () => {
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(5)

      await expect(
        service.reserve({ ...reservation, agent: DAILY_PROMPT_AGENT }),
      ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })

      const { where } = tx.aiUsageLog.count.mock.calls[0][0]
      expect(where.agent).toBe(DAILY_PROMPT_AGENT)
    })

    it('inserts a system row without locking or counting when userId is null', async () => {
      const { tx, service } = setup()

      await expect(service.reserve({ ...reservation, userId: null })).resolves.toBe('usage-1')
      expect(tx.$executeRaw).not.toHaveBeenCalled()
      expect(tx.aiUsageLog.count).not.toHaveBeenCalled()
      expect(tx.aiUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
      )
    })
  })

  describe('finalize', () => {
    it('updates the reserved row with the outcome', async () => {
      const { db, service } = setup()

      await service.finalize('usage-1', outcome)

      expect(db.aiUsageLog.update).toHaveBeenCalledWith({
        where: { id: 'usage-1' },
        data: outcome,
      })
    })

    it('swallows and logs Prisma errors without rethrowing', async () => {
      const { db, log, service } = setup()
      const error = new Error('connection refused')
      db.aiUsageLog.update.mockRejectedValue(error)

      await expect(service.finalize('usage-1', outcome)).resolves.toBeUndefined()
      expect(log.error).toHaveBeenCalledWith('Failed to record AI usage', {
        error,
        usageId: 'usage-1',
      })
    })
  })

  describe('reserveVoiceSession', () => {
    it('inserts a pending voice row under the user lock when under the voice budget', async () => {
      vi.stubEnv('VOICE_SESSION_MAX', '3')
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(2)

      await expect(service.reserveVoiceSession('user-1')).resolves.toBe('usage-1')
      expect(tx.$executeRaw.mock.calls[0]).toContain('user-1')
      expect(tx.aiUsageLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          agent: VOICE_SESSION_AGENT,
          model: VOICE_SESSION_MODEL,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          success: false,
        },
        select: { id: true },
      })
    })

    it('counts only the user voice rows inside the voice window', async () => {
      vi.stubEnv('VOICE_SESSION_WINDOW_SECONDS', '7200')
      const { tx, service } = setup()

      await service.reserveVoiceSession('user-1')

      expect(tx.aiUsageLog.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          agent: VOICE_SESSION_AGENT,
          createdAt: { gte: new Date(NOW.getTime() - 7200 * 1000) },
        },
      })
    })

    it('throws TOO_MANY_REQUESTS without inserting when the voice budget is used up', async () => {
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(3)

      const result = service.reserveVoiceSession('user-1')

      await expect(result).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
      expect(tx.aiUsageLog.create).not.toHaveBeenCalled()
    })

    it('ignores the shared AI limit', async () => {
      vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '1')
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(2)

      await expect(service.reserveVoiceSession('user-1')).resolves.toBe('usage-1')
    })
  })

  describe('rate limit exemption', () => {
    it.each([
      ['the shared limit', (service: AiUsageService) => service.reserve(reservation)],
      ['the voice budget', (service: AiUsageService) => service.reserveVoiceSession('user-1')],
    ])('lets an exempt user past %s while still logging the call', async (_label, call) => {
      vi.stubEnv('AI_RATE_LIMIT_EXEMPT_USER_IDS', ' demo-user , user-1 ')
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(1_000)

      await expect(call(service)).resolves.toBe('usage-1')
      expect(tx.aiUsageLog.count).not.toHaveBeenCalled()
      expect(tx.aiUsageLog.create).toHaveBeenCalledOnce()
    })

    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['another user', 'demo-user'],
      ['a partial ID', 'user'],
    ])('still limits everyone else when the exempt list is %s', async (_label, value) => {
      vi.stubEnv('AI_RATE_LIMIT_EXEMPT_USER_IDS', value)
      const { tx, service } = setup()
      tx.aiUsageLog.count.mockResolvedValue(1_000)

      await expect(service.reserve(reservation)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      })
    })
  })

  describe('finalizeVoiceSession', () => {
    const voiceOutcome = { usageId: 'usage-1', userId: 'user-1', seconds: 91.4, success: true }

    it('records the duration once, only on the owner unfinalized voice row', async () => {
      const { db, service } = setup()

      await expect(service.finalizeVoiceSession(voiceOutcome)).resolves.toBe(true)
      expect(db.aiUsageLog.updateMany).toHaveBeenCalledWith({
        where: { id: 'usage-1', userId: 'user-1', agent: VOICE_SESSION_AGENT, latencyMs: 0 },
        data: { latencyMs: 91_400, success: true },
      })
    })

    it.each([
      [10_000, 600_000],
      [-5, 0],
    ])('clamps a reported %is to %ims', async (seconds, latencyMs) => {
      const { db, service } = setup()

      await service.finalizeVoiceSession({ ...voiceOutcome, seconds })

      expect(db.aiUsageLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { latencyMs, success: true } }),
      )
    })

    it('returns false when no matching row was updated', async () => {
      const { db, service } = setup()
      db.aiUsageLog.updateMany.mockResolvedValue({ count: 0 })

      await expect(service.finalizeVoiceSession(voiceOutcome)).resolves.toBe(false)
    })

    it('swallows and logs Prisma errors without rethrowing', async () => {
      const { db, log, service } = setup()
      const error = new Error('connection refused')
      db.aiUsageLog.updateMany.mockRejectedValue(error)

      await expect(service.finalizeVoiceSession(voiceOutcome)).resolves.toBe(false)
      expect(log.error).toHaveBeenCalledWith('Failed to record voice session usage', {
        error,
        usageId: 'usage-1',
      })
    })
  })

  describe('getVoiceConfig', () => {
    it('defaults to 3 sessions per 24 hours', () => {
      const { service } = setup()

      expect(service.getVoiceConfig()).toEqual({ windowSeconds: 86_400, maxCalls: 3 })
    })

    it('reads the voice window and limit from env vars', () => {
      vi.stubEnv('VOICE_SESSION_WINDOW_SECONDS', '3600')
      vi.stubEnv('VOICE_SESSION_MAX', '5')
      const { service } = setup()

      expect(service.getVoiceConfig()).toEqual({ windowSeconds: 3600, maxCalls: 5 })
    })
  })

  describe('getConfig', () => {
    it('reads the window and limit from env vars', () => {
      vi.stubEnv('AI_RATE_LIMIT_WINDOW_SECONDS', '120')
      vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '10')
      const { service } = setup()

      expect(service.getConfig()).toEqual({ windowSeconds: 120, maxCalls: 10 })
    })

    it.each([
      ['unset', undefined],
      ['not a number', 'abc'],
      ['zero', '0'],
    ])('falls back to defaults when env vars are %s', (_label, value) => {
      vi.stubEnv('AI_RATE_LIMIT_WINDOW_SECONDS', value)
      vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', value)
      const { service } = setup()

      expect(service.getConfig()).toEqual({ windowSeconds: 3600, maxCalls: 50 })
    })
  })
})
