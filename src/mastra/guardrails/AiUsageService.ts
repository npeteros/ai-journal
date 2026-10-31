import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import prisma from '@/src/lib/prisma'
import type { PrismaClient } from '@/src/generated/prisma/client'
import { logger } from '../observability'

const DEFAULT_WINDOW_SECONDS = 3600
const DEFAULT_MAX_CALLS = 50

export type AiUsageEntry = {
  userId: string | null
  agent: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
}

export type AiRateLimitConfig = {
  windowSeconds: number
  maxCalls: number
}

type AiUsageDb = {
  aiUsageLog: Pick<PrismaClient['aiUsageLog'], 'create' | 'count'>
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

  /** Writes one usage row. Never throws: a failed write must not fail the AI call. */
  async record(entry: AiUsageEntry): Promise<void> {
    try {
      await this.db.aiUsageLog.create({ data: entry })
    } catch (error) {
      this.log.error('Failed to record AI usage', {
        error,
        agent: entry.agent,
        userId: entry.userId,
      })
    }
  }

  /** Throws TOO_MANY_REQUESTS when the user has used up their calls for the current window. */
  async assertWithinLimit(userId: string): Promise<void> {
    const { windowSeconds, maxCalls } = this.getConfig()
    const windowStart = new Date(Date.now() - windowSeconds * 1000)

    const count = await this.db.aiUsageLog.count({
      where: { userId, createdAt: { gte: windowStart } },
    })

    if (count >= maxCalls) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `AI rate limit exceeded: ${maxCalls} calls per ${windowSeconds}s`,
      })
    }
  }
}

export const aiUsageService = new AiUsageService()
