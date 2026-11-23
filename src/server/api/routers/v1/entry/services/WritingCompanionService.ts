import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'
import prisma from '@/src/lib/prisma'
import type { PrismaClient } from '@/src/generated/prisma/client'
import {
  COMPANION_COOLDOWN_MS,
  COMPANION_MAX_PER_ENTRY,
  countWords,
  evaluateCompanionRequest,
  type CompanionBlockReason,
  type CompanionTrigger,
} from '@/src/lib/companion'
import { mastra } from '@/src/mastra'
import {
  WRITING_COMPANION_AGENT_ID,
  WritingCompanionOutputSchema,
  buildWritingCompanionPrompt,
  type WritingCompanionInput,
} from '@/src/mastra/agents/writing-companion-agent'
import { isAiRateLimited, type TripwireInfo } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'

const GENERATION_TIMEOUT_MS = 20_000

export type CompanionQuestionStatus = 'pending' | 'answered' | 'failed'

export type CompanionResult =
  | { status: 'ok'; question: string; remaining: number; retryAt: string }
  /** Refused by the per-entry rules in src/lib/companion.ts. */
  | { status: 'blocked'; reason: CompanionBlockReason; retryAt?: string }
  /** The user's writing companion budget is used up. */
  | { status: 'limited' }
  /** The model failed or returned nothing usable; the client stays quiet. */
  | { status: 'unavailable' }

export type AskCompanionInput = {
  userId: string
  entryId: string
  /** The entry's current text, which may be ahead of the last autosave. */
  text: string
  trigger: CompanionTrigger
}

export type CompanionAgentResult = { question?: string; tripwire?: TripwireInfo }

export type CompanionAgentCall = (input: {
  userId: string
  prompt: WritingCompanionInput
}) => Promise<CompanionAgentResult>

const callWritingCompanionAgent: CompanionAgentCall = async ({ userId, prompt }) => {
  const result = await mastra
    .getAgentById(WRITING_COMPANION_AGENT_ID)
    .generate(buildWritingCompanionPrompt(prompt), {
      requestContext: createUserRequestContext(userId),
      structuredOutput: { schema: WritingCompanionOutputSchema },
      modelSettings: { timeout: { totalMs: GENERATION_TIMEOUT_MS } },
    })
  return { question: result.object?.question, tripwire: result.tripwire }
}

type CompanionDb = Pick<PrismaClient, '$transaction'> & {
  writingCompanionQuestion: Pick<PrismaClient['writingCompanionQuestion'], 'update'>
}

type Reservation =
  | { kind: 'blocked'; result: CompanionResult }
  | {
      kind: 'reserved'
      rowId: string
      prompt: WritingCompanionInput
      /** Questions for this entry once this one is answered. */
      asked: number
    }

/**
 * Asks the writing companion for one follow-up question while the user writes.
 *
 * The per-entry rules (cooldown, cap, new words) are checked here against
 * `WritingCompanionQuestion` rows, so the browser can't bypass them. The user's overall budget is
 * enforced by `aiUsageProcessor` on the agent. `ask()` reports every refusal or failure as a
 * status instead of throwing, except for an entry that isn't the user's (NOT_FOUND).
 */
export class WritingCompanionService {
  constructor(
    private readonly callAgent: CompanionAgentCall = callWritingCompanionAgent,
    private readonly db: CompanionDb = prisma,
    private readonly log: IMastraLogger = logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ask({ userId, entryId, text, trigger }: AskCompanionInput): Promise<CompanionResult> {
    const wordCount = countWords(text)
    const reservation = await this.reserve({ userId, entryId, text, trigger, wordCount })
    if (reservation.kind === 'blocked') return reservation.result

    const { rowId, prompt, asked } = reservation
    try {
      const { question, tripwire } = await this.callAgent({ userId, prompt })

      if (tripwire) {
        const rateLimited = isAiRateLimited(tripwire)
        this.log.warn('Writing companion question blocked', {
          userId,
          entryId,
          rateLimited,
          processorId: tripwire.processorId,
        })
        await this.markFailed(rowId)
        return rateLimited ? { status: 'limited' } : { status: 'unavailable' }
      }

      const cleaned = question?.trim() ?? ''
      if (cleaned === '') {
        this.log.warn('Writing companion returned no question', { userId, entryId })
        await this.markFailed(rowId)
        return { status: 'unavailable' }
      }

      const updated = await this.db.writingCompanionQuestion.update({
        where: { id: rowId },
        data: { status: 'answered' satisfies CompanionQuestionStatus, question: cleaned },
        select: { createdAt: true },
      })
      return {
        status: 'ok',
        question: cleaned,
        remaining: Math.max(COMPANION_MAX_PER_ENTRY - asked, 0),
        retryAt: new Date(updated.createdAt.getTime() + COMPANION_COOLDOWN_MS).toISOString(),
      }
    } catch (error) {
      this.log.warn('Writing companion question failed', {
        userId,
        entryId,
        error: error instanceof Error ? error.message : String(error),
      })
      await this.markFailed(rowId)
      return { status: 'unavailable' }
    }
  }

  /**
   * Checks the per-entry rules and records a pending question in one transaction, locked per
   * user, so parallel requests can't both pass the checks.
   */
  private reserve({
    userId,
    entryId,
    text,
    trigger,
    wordCount,
  }: AskCompanionInput & { wordCount: number }): Promise<Reservation> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

      const entry = await tx.entry.findFirst({
        where: { id: entryId, userId, deletedAt: null },
        select: { title: true, tags: { select: { tag: { select: { name: true } } } } },
      })
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' })

      // Pending rows count too: a question being generated still uses up the slot.
      const prior = await tx.writingCompanionQuestion.findMany({
        where: { entryId, status: { not: 'failed' satisfies CompanionQuestionStatus } },
        select: { createdAt: true, wordCount: true, question: true },
        orderBy: { createdAt: 'asc' },
      })

      const decision = evaluateCompanionRequest({ now: this.now(), trigger, wordCount, prior })
      if (!decision.ok) {
        return {
          kind: 'blocked',
          result: {
            status: 'blocked',
            reason: decision.reason,
            ...(decision.retryAt && { retryAt: decision.retryAt.toISOString() }),
          },
        }
      }

      const row = await tx.writingCompanionQuestion.create({
        data: {
          entryId,
          userId,
          wordCount,
          status: 'pending' satisfies CompanionQuestionStatus,
        },
        select: { id: true },
      })

      return {
        kind: 'reserved',
        rowId: row.id,
        asked: prior.length + 1,
        prompt: {
          title: entry.title,
          tags: entry.tags.map(({ tag }) => tag.name),
          body: text,
          previousQuestions: prior.flatMap(({ question }) => (question ? [question] : [])),
        },
      }
    })
  }

  /** Never throws: a failed status write must not turn into an error for the user. */
  private async markFailed(rowId: string): Promise<void> {
    try {
      await this.db.writingCompanionQuestion.update({
        where: { id: rowId },
        data: { status: 'failed' satisfies CompanionQuestionStatus },
      })
    } catch (error) {
      this.log.error('Failed to mark writing companion question as failed', { error, rowId })
    }
  }
}

export const writingCompanionService = new WritingCompanionService()
