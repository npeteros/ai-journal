import { createHash } from 'node:crypto'
import type { IMastraLogger } from '@mastra/core/logger'
import prisma from '@/src/lib/prisma'
import {
  ENTRY_ANALYSIS_AGENT_ID,
  ENTRY_ANALYSIS_MODEL,
  buildEntryAnalysisPrompt,
  entryAnalysisOutputSchema,
  normalizeAnalysis,
  type EntryAnalysisData,
} from '@/src/mastra/agents/entry-analysis-agent'
import { isAiRateLimited, type TripwireInfo } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'

export function hashBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

export type AnalyzeEntryInput = {
  entryId: string
  userId: string
  /** Hash of the body that triggered this run; a different current body means a newer save owns it. */
  triggerBodyHash: string
}

export type AnalyzeEntryStatus =
  'analyzed' | 'skipped_missing' | 'skipped_stale' | 'skipped_unchanged' | 'rate_limited' | 'failed'

export type AnalysisAgentInput = { userId: string; body: string; tagNames: string[] }
export type AnalysisAgentResult = { object?: unknown; tripwire?: TripwireInfo }
export type AnalysisAgentCall = (input: AnalysisAgentInput) => Promise<AnalysisAgentResult>

export type EntryForAnalysis = {
  body: string
  tagNames: string[]
  analysisBodyHash: string | null
}

export type EntryAnalysisRecord = EntryAnalysisData & {
  bodyHash: string
  model: string
  analyzedAt: Date
}

export type EntryAnalysisRepository = {
  findEntry(entryId: string, userId: string): Promise<EntryForAnalysis | null>
  saveAnalysis(entryId: string, record: EntryAnalysisRecord): Promise<void>
}

// Imported lazily: src/mastra/index.ts registers the workflow that uses this service.
const callEntryAnalysisAgent: AnalysisAgentCall = async ({ userId, body, tagNames }) => {
  const { mastra } = await import('@/src/mastra')
  const result = await mastra
    .getAgentById(ENTRY_ANALYSIS_AGENT_ID)
    .generate(buildEntryAnalysisPrompt(body, tagNames), {
      requestContext: createUserRequestContext(userId),
      structuredOutput: { schema: entryAnalysisOutputSchema },
    })
  return { object: result.object, tripwire: result.tripwire }
}

export const prismaEntryAnalysisRepository: EntryAnalysisRepository = {
  async findEntry(entryId, userId) {
    const entry = await prisma.entry.findFirst({
      where: { id: entryId, userId, deletedAt: null },
      select: {
        body: true,
        analysis: { select: { bodyHash: true } },
        tags: { where: { tag: { deletedAt: null } }, select: { tag: { select: { name: true } } } },
      },
    })
    if (!entry) return null
    return {
      body: entry.body,
      tagNames: entry.tags.map(({ tag }) => tag.name),
      analysisBodyHash: entry.analysis?.bodyHash ?? null,
    }
  },

  async saveAnalysis(entryId, record) {
    await prisma.entryAnalysis.upsert({
      where: { entryId },
      create: { entryId, ...record },
      update: record,
    })
  },
}

/**
 * Analyzes a journal entry (mood, summary, themes, suggested tags) and stores the result.
 * Runs in the background, so `analyze()` never throws: skips, rate limits and failures are
 * logged and reported through the returned status, and the entry is simply left without
 * a (new) analysis.
 */
export class EntryAnalysisService {
  constructor(
    private readonly callAgent: AnalysisAgentCall = callEntryAnalysisAgent,
    private readonly repository: EntryAnalysisRepository = prismaEntryAnalysisRepository,
    private readonly log: IMastraLogger = logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async analyze({
    entryId,
    userId,
    triggerBodyHash,
  }: AnalyzeEntryInput): Promise<AnalyzeEntryStatus> {
    try {
      const entry = await this.repository.findEntry(entryId, userId)
      if (!entry) return 'skipped_missing'

      const bodyHash = hashBody(entry.body)
      if (bodyHash !== triggerBodyHash) return 'skipped_stale'
      if (entry.analysisBodyHash === bodyHash) return 'skipped_unchanged'

      const { object, tripwire } = await this.callAgent({
        userId,
        body: entry.body,
        tagNames: entry.tagNames,
      })

      if (tripwire) {
        const rateLimited = isAiRateLimited(tripwire)
        this.log.warn('Entry analysis blocked; entry left without a new analysis', {
          entryId,
          userId,
          rateLimited,
          processorId: tripwire.processorId,
        })
        return rateLimited ? 'rate_limited' : 'failed'
      }

      const analysis = normalizeAnalysis(object, entry.tagNames)
      if (!analysis) {
        this.log.warn('Entry analysis returned unusable output', { entryId, userId })
        return 'failed'
      }

      await this.repository.saveAnalysis(entryId, {
        ...analysis,
        bodyHash,
        model: ENTRY_ANALYSIS_MODEL,
        analyzedAt: this.now(),
      })
      return 'analyzed'
    } catch (error) {
      this.log.warn('Entry analysis failed', {
        entryId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return 'failed'
    }
  }
}

export const entryAnalysisService = new EntryAnalysisService()
