// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import { AiUsageService, type AiUsageEntry } from '../AiUsageService'

// Keep the real Prisma client and Mastra observability out of unit tests.
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('../../observability', () => ({ logger: {} }))

const NOW = new Date('2026-10-30T12:00:00.000Z')

const entry: AiUsageEntry = {
  userId: 'user-1',
  agent: 'weather-agent',
  model: 'openai/gpt-5-mini',
  inputTokens: 120,
  outputTokens: 45,
  latencyMs: 830,
  success: true,
}

function setup() {
  const db = {
    aiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
  }
  const log = { error: vi.fn() }
  const service = new AiUsageService(
    db as unknown as ConstructorParameters<typeof AiUsageService>[0],
    log as unknown as IMastraLogger,
  )
  return { db, log, service }
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

  describe('record', () => {
    it('writes a row with the correct fields', async () => {
      const { db, service } = setup()

      await service.record(entry)

      expect(db.aiUsageLog.create).toHaveBeenCalledWith({ data: entry })
    })

    it('swallows and logs Prisma errors without rethrowing', async () => {
      const { db, log, service } = setup()
      const error = new Error('connection refused')
      db.aiUsageLog.create.mockRejectedValue(error)

      await expect(service.record(entry)).resolves.toBeUndefined()
      expect(log.error).toHaveBeenCalledWith('Failed to record AI usage', {
        error,
        agent: entry.agent,
        userId: entry.userId,
      })
    })
  })

  describe('assertWithinLimit', () => {
    it('allows calls under the limit', async () => {
      vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '5')
      const { db, service } = setup()
      db.aiUsageLog.count.mockResolvedValue(4)

      await expect(service.assertWithinLimit('user-1')).resolves.toBeUndefined()
    })

    it.each([5, 6])(
      'throws TOO_MANY_REQUESTS when count is %i with a limit of 5',
      async (count) => {
        vi.stubEnv('AI_RATE_LIMIT_MAX_CALLS', '5')
        const { db, service } = setup()
        db.aiUsageLog.count.mockResolvedValue(count)

        const result = service.assertWithinLimit('user-1')

        await expect(result).rejects.toBeInstanceOf(TRPCError)
        await expect(result).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
      },
    )

    it('counts only rows inside the window', async () => {
      vi.stubEnv('AI_RATE_LIMIT_WINDOW_SECONDS', '600')
      const { db, service } = setup()

      await service.assertWithinLimit('user-1')

      const { where } = db.aiUsageLog.count.mock.calls[0][0]
      expect(where.createdAt).toEqual({ gte: new Date(NOW.getTime() - 600 * 1000) })
    })

    it('counts only rows for the specified user', async () => {
      const { db, service } = setup()

      await service.assertWithinLimit('user-42')

      const { where } = db.aiUsageLog.count.mock.calls[0][0]
      expect(where.userId).toBe('user-42')
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
