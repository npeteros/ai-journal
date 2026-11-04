import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import prisma from '@/src/lib/prisma'
import type { PrismaClient } from '@/src/generated/prisma/client'
import { logger } from '../observability'

const DEFAULT_WINDOW_SECONDS = 3600
const DEFAULT_MAX_CALLS = 50

export type AiUsageReservation = {
  /** Null for system calls (e.g. workflows with no signed-in user), which skip the rate limit. */
  userId: string | null
  agent: string
  model: string
}

export type AiUsageOutcome = {
  model?: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
}

export type AiRateLimitConfig = {
  windowSeconds: number
  maxCalls: number
}

type AiUsageDb = Pick<PrismaClient, '$transaction'> & {
  aiUsageLog: Pick<PrismaClient['aiUsageLog'], 'update'>
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Records AI token usage and enforces a per-user rolling-window rate limit,
 * both backed by the AiUsageLog table.
 */
export class AiUsageService {
  constructor(
    private readonly db: AiUsageDb = prisma,
    private readonly log: IMastraLogger = logger,
  ) {}

  // Read on every call so limits can change without a redeploy (and in tests).
  getConfig(): AiRateLimitConfig {
    return {
      windowSeconds: readPositiveInt(
        process.env.AI_RATE_LIMIT_WINDOW_SECONDS,
        DEFAULT_WINDOW_SECONDS,
      ),
      maxCalls: readPositiveInt(process.env.AI_RATE_LIMIT_MAX_CALLS, DEFAULT_MAX_CALLS),
    }
  }

  /**
   * Checks the rate limit and inserts the call's usage row before the model is called,
   * so in-flight calls count toward the limit. Returns the row ID for `finalize()`.
   * Throws TOO_MANY_REQUESTS when the user has used up their calls for the current window.
   *
   * The row starts as a failed call with no tokens, which is what remains if the call
   * never finalizes (e.g. the process dies mid-stream).
   */
  async reserve({ userId, agent, model }: AiUsageReservation): Promise<string> {
    const { windowSeconds, maxCalls } = this.getConfig()
    const windowStart = new Date(Date.now() - windowSeconds * 1000)

    return this.db.$transaction(async (tx) => {
      // System calls (no user) are logged but not rate-limited.
      if (userId !== null) {
        // Serialises reservations per user so concurrent requests can't all pass the count.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

        const count = await tx.aiUsageLog.count({
          where: { userId, createdAt: { gte: windowStart } },
        })

        if (count >= maxCalls) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `AI rate limit exceeded: ${maxCalls} calls per ${windowSeconds}s`,
          })
        }
      }

      const row = await tx.aiUsageLog.create({
        data: {
          userId,
          agent,
          model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          success: false,
        },
        select: { id: true },
      })
      return row.id
    })
  }

  /** Updates a reserved row with the call's outcome. Never throws: a failed write must not fail the AI call. */
  async finalize(id: string, outcome: AiUsageOutcome): Promise<void> {
    try {
      await this.db.aiUsageLog.update({ where: { id }, data: outcome })
    } catch (error) {
      this.log.error('Failed to record AI usage', { error, usageId: id })
    }
  }
}

export const aiUsageService = new AiUsageService()
