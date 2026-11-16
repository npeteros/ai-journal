import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import prisma from '@/src/lib/prisma'
import type { PrismaClient } from '@/src/generated/prisma/client'
import { logger } from '../observability'

const DEFAULT_WINDOW_SECONDS = 3600
const DEFAULT_MAX_CALLS = 50
const DEFAULT_VOICE_WINDOW_SECONDS = 86_400
const DEFAULT_VOICE_MAX_SESSIONS = 3

/** `agent` value of voice session rows. They have their own budget, outside the shared AI limit. */
export const VOICE_SESSION_AGENT = 'voice-session'
export const VOICE_SESSION_MODEL = 'openai/gpt-live-1'
/** Longest voice session we record, matching the client-side session cap. */
export const VOICE_SESSION_MAX_SECONDS = 600

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

export type VoiceSessionOutcome = {
  usageId: string
  /** Owner of the row; only they can finalize it. */
  userId: string
  /** Session length reported by the client, capped at VOICE_SESSION_MAX_SECONDS. */
  seconds: number
  success: boolean
}

type AiUsageDb = Pick<PrismaClient, '$transaction'> & {
  aiUsageLog: Pick<PrismaClient['aiUsageLog'], 'update' | 'updateMany'>
}

type ReserveLimit = {
  windowSeconds: number
  maxCalls: number
  /** Which of the user's rows count toward this limit. */
  agentFilter: { agent: string } | { agent: { not: string } }
  message: string
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

  /** Voice sessions have their own budget (default 3 per rolling 24 hours). */
  getVoiceConfig(): AiRateLimitConfig {
    return {
      windowSeconds: readPositiveInt(
        process.env.VOICE_SESSION_WINDOW_SECONDS,
        DEFAULT_VOICE_WINDOW_SECONDS,
      ),
      maxCalls: readPositiveInt(process.env.VOICE_SESSION_MAX, DEFAULT_VOICE_MAX_SESSIONS),
    }
  }

  /**
   * Checks the rate limit and inserts the call's usage row before the model is called,
   * so in-flight calls count toward the limit. Returns the row ID for `finalize()`.
   * Throws TOO_MANY_REQUESTS when the user has used up their calls for the current window.
   * Voice session rows don't count toward this limit; they have their own budget.
   *
   * The row starts as a failed call with no tokens, which is what remains if the call
   * never finalizes (e.g. the process dies mid-stream).
   */
  async reserve({ userId, agent, model }: AiUsageReservation): Promise<string> {
    const { windowSeconds, maxCalls } = this.getConfig()
    return this.reserveRow(
      { userId, agent, model },
      {
        windowSeconds,
        maxCalls,
        agentFilter: { agent: { not: VOICE_SESSION_AGENT } },
        message: `AI rate limit exceeded: ${maxCalls} calls per ${windowSeconds}s`,
      },
    )
  }

  /**
   * Checks the user's voice session budget and inserts the session's usage row before the
   * realtime session is created. Returns the row ID for `finalizeVoiceSession()`.
   * Throws TOO_MANY_REQUESTS when the user has used up their sessions for the current window.
   */
  async reserveVoiceSession(userId: string): Promise<string> {
    const { windowSeconds, maxCalls } = this.getVoiceConfig()
    return this.reserveRow(
      { userId, agent: VOICE_SESSION_AGENT, model: VOICE_SESSION_MODEL },
      {
        windowSeconds,
        maxCalls,
        agentFilter: { agent: VOICE_SESSION_AGENT },
        message: `Voice session limit exceeded: ${maxCalls} sessions per ${windowSeconds}s`,
      },
    )
  }

  private async reserveRow(
    { userId, agent, model }: AiUsageReservation,
    limit: ReserveLimit,
  ): Promise<string> {
    const windowStart = new Date(Date.now() - limit.windowSeconds * 1000)

    return this.db.$transaction(async (tx) => {
      // System calls (no user) are logged but not rate-limited.
      if (userId !== null) {
        // Serialises reservations per user so concurrent requests can't all pass the count.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

        const count = await tx.aiUsageLog.count({
          where: { userId, createdAt: { gte: windowStart }, ...limit.agentFilter },
        })

        if (count >= limit.maxCalls) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: limit.message })
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

  /**
   * Records a voice session's length (in `latencyMs`; voice has no token counts) on its reserved
   * row. Only the row's owner can finalize it, and only once: the first report wins. Returns
   * whether a row was updated. Never throws.
   */
  async finalizeVoiceSession({
    usageId,
    userId,
    seconds,
    success,
  }: VoiceSessionOutcome): Promise<boolean> {
    const cappedSeconds = Math.min(Math.max(seconds, 0), VOICE_SESSION_MAX_SECONDS)
    try {
      const { count } = await this.db.aiUsageLog.updateMany({
        where: { id: usageId, userId, agent: VOICE_SESSION_AGENT, latencyMs: 0 },
        data: { latencyMs: Math.round(cappedSeconds * 1000), success },
      })
      return count > 0
    } catch (error) {
      this.log.error('Failed to record voice session usage', { error, usageId })
      return false
    }
  }
}

export const aiUsageService = new AiUsageService()
