import { randomUUID } from 'node:crypto'
import type { IMastraLogger } from '@mastra/core/logger'
import { isMastraTimeoutError } from '@mastra/core/loop'
import prisma from '@/src/lib/prisma'
import {
  INSIGHTS_AGENT_ID,
  INSIGHTS_MODEL,
  InsightReportOutputSchema,
  buildInsightsPrompt,
  type InsightSourceEntry,
  type PreviousThemeCount,
} from '@/src/mastra/agents/insights-agent'
import { isAiRateLimited, type TripwireInfo } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { filterOwnedInsightReport, type InsightReportData } from '../report-schema'

export const INSIGHT_REPORT_MIN_ANALYZED_ENTRIES = 5
export const INSIGHT_REPORT_PERIOD_DAYS = 30
export const INSIGHT_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const INSIGHT_REPORT_LEASE_MS = 15 * 60 * 1000
export const INSIGHT_REPORT_LEASE_SAFETY_MS = 60 * 1000
export const INSIGHT_REPORT_DEFAULT_MAX_SOURCE_ENTRIES = 50
export const INSIGHT_REPORT_DEFAULT_GENERATION_TIMEOUT_MS = 10 * 60 * 1000

export type InsightReportStatus =
  | 'generated'
  | 'insufficient_entries'
  | 'insufficient_evidence'
  | 'cooldown'
  | 'refresh_in_progress'
  | 'rate_limited'
  | 'timed_out'
  | 'failed'

export type InsightReportWindows = {
  currentStart: Date
  currentEnd: Date
  currentEndExclusive: Date
  previousStart: Date
  previousEndExclusive: Date
}

export type InsightSource = InsightSourceEntry

export type InsightReportLimits = {
  /** Most-recent analyzed entries included in the model prompt, kept oldest-to-newest. */
  maxSourceEntries: number
  /** Hard Mastra model-run deadline; always shorter than the database lease. */
  generationTimeoutMs: number
}

type InsightReportEnvironment = {
  INSIGHT_REPORT_MAX_SOURCE_ENTRIES?: string
  INSIGHT_REPORT_GENERATION_TIMEOUT_MS?: string
}

export type InsightReportRecord = InsightReportData & {
  periodStart: Date
  periodEnd: Date
  entryCount: number
  model: string
  createdAt: Date
}

export type InsightReportAgentResult = { object?: unknown; tripwire?: TripwireInfo }
export type InsightReportAgentCall = (input: {
  userId: string
  entries: InsightSource[]
  previousThemes: PreviousThemeCount[]
  timeoutMs: number
}) => Promise<InsightReportAgentResult>

export type InsightReportRepository = {
  claimRefresh(
    userId: string,
    token: string,
    now: Date,
  ): Promise<'claimed' | 'cooldown' | 'in_progress'>
  loadSources(
    userId: string,
    windows: InsightReportWindows,
  ): Promise<{
    current: InsightSource[]
    previousThemes: PreviousThemeCount[]
  }>
  saveReport(userId: string, token: string, report: InsightReportRecord): Promise<boolean>
  releaseRefresh(userId: string, token: string, now: Date): Promise<void>
}

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function shiftDays(day: Date, days: number): Date {
  const result = new Date(day)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Runtime-configurable safeguards. The source limit never drops below the evidence threshold,
 * and the model deadline always leaves time for the lease cleanup to complete.
 */
export function insightReportLimits(
  env: InsightReportEnvironment = {
    INSIGHT_REPORT_MAX_SOURCE_ENTRIES: process.env.INSIGHT_REPORT_MAX_SOURCE_ENTRIES,
    INSIGHT_REPORT_GENERATION_TIMEOUT_MS: process.env.INSIGHT_REPORT_GENERATION_TIMEOUT_MS,
  },
): InsightReportLimits {
  const maxSourceEntries = Math.max(
    INSIGHT_REPORT_MIN_ANALYZED_ENTRIES,
    positiveInteger(
      env.INSIGHT_REPORT_MAX_SOURCE_ENTRIES,
      INSIGHT_REPORT_DEFAULT_MAX_SOURCE_ENTRIES,
    ),
  )
  const maximumTimeout = INSIGHT_REPORT_LEASE_MS - INSIGHT_REPORT_LEASE_SAFETY_MS
  const generationTimeoutMs = Math.min(
    maximumTimeout,
    positiveInteger(
      env.INSIGHT_REPORT_GENERATION_TIMEOUT_MS,
      INSIGHT_REPORT_DEFAULT_GENERATION_TIMEOUT_MS,
    ),
  )
  return { maxSourceEntries, generationTimeoutMs }
}

export function insightReportWindows(now: Date): InsightReportWindows {
  const currentEnd = utcDay(now)
  return {
    currentStart: shiftDays(currentEnd, -(INSIGHT_REPORT_PERIOD_DAYS - 1)),
    currentEnd,
    currentEndExclusive: shiftDays(currentEnd, 1),
    previousStart: shiftDays(currentEnd, -(INSIGHT_REPORT_PERIOD_DAYS * 2 - 1)),
    previousEndExclusive: shiftDays(currentEnd, -(INSIGHT_REPORT_PERIOD_DAYS - 1)),
  }
}

/** Selects the most recent entries deterministically while retaining chronological prompt order. */
export function selectInsightSources(
  entries: InsightSource[],
  maxSourceEntries: number,
): InsightSource[] {
  return [...entries]
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .slice(-maxSourceEntries)
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function previousThemeCounts(
  entries: Array<{ entryDate: Date; themes: string[] }>,
): PreviousThemeCount[] {
  const counts = new Map<string, { title: string; mentions: number }>()
  for (const entry of entries) {
    for (const rawTheme of new Set(entry.themes.map((theme) => theme.trim()).filter(Boolean))) {
      const key = rawTheme.toLowerCase()
      const current = counts.get(key) ?? { title: rawTheme, mentions: 0 }
      current.mentions += 1
      counts.set(key, current)
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.mentions - left.mentions || left.title.localeCompare(right.title))
    .slice(0, 20)
}

export const prismaInsightReportRepository: InsightReportRepository = {
  async claimRefresh(userId, token, now) {
    const cooldownStart = new Date(now.getTime() - INSIGHT_REPORT_COOLDOWN_MS)
    const leaseExpiresAt = new Date(now.getTime() + INSIGHT_REPORT_LEASE_MS)

    return prisma.$transaction(async (tx) => {
      // This lock serializes lease claims without holding a transaction open during model generation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insight-report:${userId}`}))`

      const latest = await tx.insightReport.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (latest && latest.createdAt > cooldownStart) return 'cooldown'

      const existingLease = await tx.insightReportLease.findUnique({ where: { userId } })
      if (existingLease && existingLease.expiresAt > now) return 'in_progress'

      await tx.insightReportLease.upsert({
        where: { userId },
        create: { userId, token, expiresAt: leaseExpiresAt },
        update: { token, expiresAt: leaseExpiresAt },
      })
      return 'claimed'
    })
  },

  async loadSources(userId, windows) {
    const rows = await prisma.entry.findMany({
      where: {
        userId,
        deletedAt: null,
        entryDate: { gte: windows.previousStart, lt: windows.currentEndExclusive },
        analysis: { isNot: null },
      },
      select: {
        id: true,
        entryDate: true,
        analysis: { select: { themes: true, summary: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
    })

    const current = rows
      .filter(({ entryDate }) => entryDate >= windows.currentStart)
      .flatMap((entry) =>
        entry.analysis
          ? [
              {
                id: entry.id,
                date: dateKey(entry.entryDate),
                themes: entry.analysis.themes,
                summary: entry.analysis.summary,
              },
            ]
          : [],
      )
    const previous = rows
      .filter(({ entryDate }) => entryDate < windows.previousEndExclusive)
      .flatMap((entry) =>
        entry.analysis ? [{ entryDate: entry.entryDate, themes: entry.analysis.themes }] : [],
      )

    return { current, previousThemes: previousThemeCounts(previous) }
  },

  async saveReport(userId, token, report) {
    return prisma.$transaction(async (tx) => {
      // A late worker cannot save after its lease expires or a newer worker takes ownership.
      const released = await tx.insightReportLease.updateMany({
        where: { userId, token, expiresAt: { gt: report.createdAt } },
        data: { expiresAt: report.createdAt },
      })
      if (released.count !== 1) return false

      await tx.insightReport.create({
        data: {
          userId,
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          recurringThemes: report.recurringThemes,
          growthSuggestions: report.growthSuggestions,
          trendCaption: report.trendCaption,
          entryCount: report.entryCount,
          model: report.model,
          createdAt: report.createdAt,
        },
      })
      return true
    })
  },

  async releaseRefresh(userId, token, now) {
    await prisma.insightReportLease.updateMany({
      where: { userId, token },
      data: { expiresAt: now },
    })
  },
}

// Imported lazily because src/mastra/index.ts registers the workflow that uses this service.
const callInsightsAgent: InsightReportAgentCall = async ({
  userId,
  entries,
  previousThemes,
  timeoutMs,
}) => {
  const { mastra } = await import('@/src/mastra')
  const result = await mastra
    .getAgentById(INSIGHTS_AGENT_ID)
    .generate(buildInsightsPrompt(entries, previousThemes), {
      requestContext: createUserRequestContext(userId),
      structuredOutput: { schema: InsightReportOutputSchema },
      modelSettings: { timeout: { totalMs: timeoutMs } },
    })
  return { object: result.object, tripwire: result.tripwire }
}

/** Generates a stored, user-scoped insight report. Every non-generated outcome releases its lease. */
export class InsightReportService {
  constructor(
    private readonly callAgent: InsightReportAgentCall = callInsightsAgent,
    private readonly repository: InsightReportRepository = prismaInsightReportRepository,
    private readonly log: IMastraLogger = logger,
    private readonly now: () => Date = () => new Date(),
    private readonly limits: InsightReportLimits = insightReportLimits(),
  ) {}

  async refresh(userId: string): Promise<InsightReportStatus> {
    const now = this.now()
    const token = randomUUID()
    let claimed = false
    let generationTimeoutMs = this.limits.generationTimeoutMs

    try {
      const claim = await this.repository.claimRefresh(userId, token, now)
      if (claim === 'cooldown') return 'cooldown'
      if (claim === 'in_progress') return 'refresh_in_progress'
      claimed = true

      const windows = insightReportWindows(now)
      const { current, previousThemes } = await this.repository.loadSources(userId, windows)
      if (current.length < INSIGHT_REPORT_MIN_ANALYZED_ENTRIES) return 'insufficient_entries'
      const selectedSources = selectInsightSources(current, this.limits.maxSourceEntries)
      const generationDeadline = new Date(
        now.getTime() + INSIGHT_REPORT_LEASE_MS - INSIGHT_REPORT_LEASE_SAFETY_MS,
      )
      const remainingGenerationMs = generationDeadline.getTime() - this.now().getTime()
      if (remainingGenerationMs <= 0) {
        this.log.warn('Insight report generation deadline elapsed before the model call', {
          userId,
        })
        return 'timed_out'
      }
      generationTimeoutMs = Math.min(this.limits.generationTimeoutMs, remainingGenerationMs)

      const { object, tripwire } = await this.callAgent({
        userId,
        entries: selectedSources,
        previousThemes,
        timeoutMs: generationTimeoutMs,
      })
      if (tripwire) {
        const rateLimited = isAiRateLimited(tripwire)
        this.log.warn('Insight report generation blocked', {
          userId,
          rateLimited,
          processorId: tripwire.processorId,
        })
        return rateLimited ? 'rate_limited' : 'failed'
      }

      const report = filterOwnedInsightReport(object, new Set(selectedSources.map(({ id }) => id)))
      if (
        !report ||
        (report.recurringThemes.length === 0 && report.growthSuggestions.length === 0)
      ) {
        this.log.warn('Insight report returned insufficient grounded evidence', { userId })
        return 'insufficient_evidence'
      }

      const saved = await this.repository.saveReport(userId, token, {
        ...report,
        periodStart: windows.currentStart,
        periodEnd: windows.currentEnd,
        entryCount: selectedSources.length,
        model: INSIGHTS_MODEL,
        createdAt: now,
      })
      claimed = !saved
      if (!saved) {
        this.log.warn('Insight report lease expired before persistence', { userId })
        return 'failed'
      }
      return 'generated'
    } catch (error) {
      if (isMastraTimeoutError(error)) {
        this.log.warn('Insight report generation timed out', {
          userId,
          timeoutMs: generationTimeoutMs,
        })
        return 'timed_out'
      }
      this.log.warn('Insight report generation failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return 'failed'
    } finally {
      if (claimed) {
        try {
          await this.repository.releaseRefresh(userId, token, this.now())
        } catch (error) {
          this.log.warn('Insight report refresh lease could not be released', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
  }
}

export const insightReportService = new InsightReportService()
