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
export const INSIGHT_REPORT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const INSIGHT_REPORT_MIN_NEW_ENTRIES = 3
export const INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const INSIGHT_REPORT_LOCK_TIMEOUT_MS = 5 * 60 * 1000
// Leave two minutes between an aborted model call and stale-lock recovery on Vercel Hobby.
export const INSIGHT_REPORT_LOCK_SAFETY_MS = 2 * 60 * 1000
export const INSIGHT_REPORT_DEFAULT_MAX_SOURCE_ENTRIES = 50
export const INSIGHT_REPORT_DEFAULT_GENERATION_TIMEOUT_MS = 3 * 60 * 1000

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
  /** Hard model deadline, always shorter than the five-minute stale-lock timeout. */
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
  generatedAt: Date
}

export type InsightReportState = {
  generatedAt: Date | null
  generatingAt: Date | null
  lastRefreshAt: Date | null
}

export type InsightReportAgentResult = { object?: unknown; tripwire?: TripwireInfo }
export type InsightReportAgentCall = (input: {
  userId: string
  entries: InsightSource[]
  previousThemes: PreviousThemeCount[]
  timeoutMs: number
}) => Promise<InsightReportAgentResult>

export type InsightReportRepository = {
  findReport(userId: string): Promise<InsightReportState | null>
  countAnalyzedEntries(
    userId: string,
    windows: InsightReportWindows,
    analyzedSince?: Date,
  ): Promise<number>
  ensureReport(userId: string): Promise<void>
  claimGeneration(input: {
    userId: string
    claimedAt: Date
    lockExpiresBefore: Date
    manualRefreshAfter?: Date
    isManual: boolean
  }): Promise<boolean>
  activateGeneration(userId: string, claimedAt: Date, executionAt: Date): Promise<boolean>
  loadSources(
    userId: string,
    windows: InsightReportWindows,
  ): Promise<{
    current: InsightSource[]
    previousThemes: PreviousThemeCount[]
  }>
  saveReport(userId: string, claimedAt: Date, report: InsightReportRecord): Promise<boolean>
  failGeneration(userId: string, claimedAt: Date, error: string | null): Promise<void>
}

export type InsightReportStartResult =
  | { status: 'claimed'; claimedAt: Date }
  | { status: 'not_enough_entries'; missingEntries: number }
  | { status: 'not_stale' | 'refresh_in_progress' }
  | { status: 'cooldown'; nextManualRefreshAt: Date }

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

/** Vercel Hobby permits five-minute functions; reserve two minutes for stale-lock recovery. */
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
  const maximumTimeout = INSIGHT_REPORT_LOCK_TIMEOUT_MS - INSIGHT_REPORT_LOCK_SAFETY_MS
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
  async findReport(userId) {
    return prisma.insightReport.findUnique({
      where: { userId },
      select: { generatedAt: true, generatingAt: true, lastRefreshAt: true },
    })
  },

  async countAnalyzedEntries(userId, windows, analyzedSince) {
    return prisma.entry.count({
      where: {
        userId,
        deletedAt: null,
        entryDate: { gte: windows.currentStart, lt: windows.currentEndExclusive },
        analysis: analyzedSince ? { is: { analyzedAt: { gt: analyzedSince } } } : { isNot: null },
      },
    })
  },

  async ensureReport(userId) {
    await prisma.insightReport.upsert({ where: { userId }, create: { userId }, update: {} })
  },

  async claimGeneration({ userId, claimedAt, lockExpiresBefore, manualRefreshAfter, isManual }) {
    const claimed = await prisma.insightReport.updateMany({
      where: {
        userId,
        AND: [
          { OR: [{ generatingAt: null }, { generatingAt: { lt: lockExpiresBefore } }] },
          ...(isManual
            ? [
                {
                  OR: [{ lastRefreshAt: null }, { lastRefreshAt: { lt: manualRefreshAfter } }],
                },
              ]
            : []),
        ],
      },
      data: {
        generatingAt: claimedAt,
        ...(isManual ? { lastRefreshAt: claimedAt } : {}),
      },
    })
    return claimed.count === 1
  },

  async activateGeneration(userId, claimedAt, executionAt) {
    const activated = await prisma.insightReport.updateMany({
      // Transitioning the claim atomically admits exactly one worker for this scheduled run.
      where: { userId, generatingAt: claimedAt },
      data: { generatingAt: executionAt },
    })
    return activated.count === 1
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

  async saveReport(userId, claimedAt, report) {
    const saved = await prisma.insightReport.updateMany({
      // A worker that lost its stale lock cannot overwrite a newer report.
      where: { userId, generatingAt: claimedAt },
      data: {
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        recurringThemes: report.recurringThemes,
        growthSuggestions: report.growthSuggestions,
        trendCaption: report.trendCaption,
        entryCount: report.entryCount,
        model: report.model,
        generatedAt: report.generatedAt,
        generatingAt: null,
        lastError: null,
      },
    })
    return saved.count === 1
  },

  async failGeneration(userId, claimedAt, error) {
    await prisma.insightReport.updateMany({
      where: { userId, generatingAt: claimedAt },
      data: { generatingAt: null, lastError: error },
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

function failureCode(error: unknown): string {
  if (isMastraTimeoutError(error)) return 'timed_out'
  return 'generation_failed'
}

/** Stores a single user-scoped report, preserving its last successful content during regeneration. */
export class InsightReportService {
  constructor(
    private readonly callAgent: InsightReportAgentCall = callInsightsAgent,
    private readonly repository: InsightReportRepository = prismaInsightReportRepository,
    private readonly log: IMastraLogger = logger,
    private readonly now: () => Date = () => new Date(),
    private readonly limits: InsightReportLimits = insightReportLimits(),
  ) {}

  async isStale(userId: string): Promise<boolean> {
    const now = this.now()
    const windows = insightReportWindows(now)
    const report = await this.repository.findReport(userId)
    if (!report?.generatedAt) {
      return (
        (await this.repository.countAnalyzedEntries(userId, windows)) >=
        INSIGHT_REPORT_MIN_ANALYZED_ENTRIES
      )
    }
    if (report.generatedAt.getTime() > now.getTime() - INSIGHT_REPORT_MAX_AGE_MS) return false
    return (
      (await this.repository.countAnalyzedEntries(userId, windows, report.generatedAt)) >=
      INSIGHT_REPORT_MIN_NEW_ENTRIES
    )
  }

  async remainingEntries(userId: string): Promise<number> {
    const analyzedCount = await this.repository.countAnalyzedEntries(
      userId,
      insightReportWindows(this.now()),
    )
    return Math.max(0, INSIGHT_REPORT_MIN_ANALYZED_ENTRIES - analyzedCount)
  }

  async tryStart(
    userId: string,
    options: { manual?: boolean } = {},
  ): Promise<InsightReportStartResult> {
    const now = this.now()
    const isManual = options.manual === true
    if (!isManual && !(await this.isStale(userId))) {
      const report = await this.repository.findReport(userId)
      if (!report?.generatedAt) {
        return { status: 'not_enough_entries', missingEntries: await this.remainingEntries(userId) }
      }
      return { status: 'not_stale' }
    }

    if (isManual) {
      const analyzedCount = await this.repository.countAnalyzedEntries(
        userId,
        insightReportWindows(now),
      )
      if (analyzedCount < INSIGHT_REPORT_MIN_ANALYZED_ENTRIES) {
        return {
          status: 'not_enough_entries',
          missingEntries: INSIGHT_REPORT_MIN_ANALYZED_ENTRIES - analyzedCount,
        }
      }
    }

    await this.repository.ensureReport(userId)
    const claimed = await this.repository.claimGeneration({
      userId,
      claimedAt: now,
      lockExpiresBefore: new Date(now.getTime() - INSIGHT_REPORT_LOCK_TIMEOUT_MS),
      manualRefreshAfter: new Date(now.getTime() - INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS),
      isManual,
    })
    if (claimed) return { status: 'claimed', claimedAt: now }

    const report = await this.repository.findReport(userId)
    if (
      isManual &&
      report?.lastRefreshAt &&
      report.lastRefreshAt.getTime() >= now.getTime() - INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS
    ) {
      return {
        status: 'cooldown',
        nextManualRefreshAt: new Date(
          report.lastRefreshAt.getTime() + INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS,
        ),
      }
    }
    return { status: 'refresh_in_progress' }
  }

  async generateClaimedReport(userId: string, claimedAt: Date): Promise<InsightReportStatus> {
    const now = this.now()
    const claimedReport = await this.repository.findReport(userId)
    if (
      !claimedReport?.generatingAt ||
      claimedReport.generatingAt.getTime() !== claimedAt.getTime() ||
      claimedAt.getTime() < now.getTime() - INSIGHT_REPORT_LOCK_TIMEOUT_MS
    ) {
      this.log.warn('Insight report generation skipped without an active claim', { userId })
      return 'failed'
    }

    const minimumSources = claimedReport.generatedAt
      ? INSIGHT_REPORT_MIN_NEW_ENTRIES
      : INSIGHT_REPORT_MIN_ANALYZED_ENTRIES
    // A distinct value is required even when the worker starts in the same millisecond as its claim.
    const executionAt = new Date(Math.max(this.now().getTime(), claimedAt.getTime() + 1))
    const generationDeadline = new Date(
      claimedAt.getTime() + INSIGHT_REPORT_LOCK_TIMEOUT_MS - INSIGHT_REPORT_LOCK_SAFETY_MS,
    )

    try {
      if (!(await this.repository.activateGeneration(userId, claimedAt, executionAt))) {
        this.log.warn('Insight report generation skipped because its claim is already executing', {
          userId,
        })
        return 'failed'
      }

      const windows = insightReportWindows(claimedAt)
      const { current, previousThemes } = await this.repository.loadSources(userId, windows)
      if (current.length < minimumSources) {
        await this.repository.failGeneration(userId, executionAt, null)
        return 'insufficient_entries'
      }

      const remainingGenerationMs = generationDeadline.getTime() - this.now().getTime()
      if (remainingGenerationMs <= 0) {
        await this.repository.failGeneration(userId, executionAt, 'timed_out')
        return 'timed_out'
      }

      const selectedSources = selectInsightSources(current, this.limits.maxSourceEntries)
      const { object, tripwire } = await this.callAgent({
        userId,
        entries: selectedSources,
        previousThemes,
        timeoutMs: Math.min(this.limits.generationTimeoutMs, remainingGenerationMs),
      })
      if (tripwire) {
        const rateLimited = isAiRateLimited(tripwire)
        this.log.warn('Insight report generation blocked', {
          userId,
          rateLimited,
          processorId: tripwire.processorId,
        })
        await this.repository.failGeneration(
          userId,
          executionAt,
          rateLimited ? 'rate_limited' : 'generation_failed',
        )
        return rateLimited ? 'rate_limited' : 'failed'
      }

      const report = filterOwnedInsightReport(object, new Set(selectedSources.map(({ id }) => id)))
      if (
        !report ||
        (report.recurringThemes.length === 0 && report.growthSuggestions.length === 0)
      ) {
        await this.repository.failGeneration(userId, executionAt, 'insufficient_evidence')
        return 'insufficient_evidence'
      }

      const saved = await this.repository.saveReport(userId, executionAt, {
        ...report,
        periodStart: windows.currentStart,
        periodEnd: windows.currentEnd,
        entryCount: selectedSources.length,
        model: INSIGHTS_MODEL,
        generatedAt: claimedAt,
      })
      if (!saved) {
        this.log.warn('Insight report claim was replaced before persistence', { userId })
        return 'failed'
      }
      return 'generated'
    } catch (error) {
      const code = failureCode(error)
      this.log.warn('Insight report generation failed', {
        userId,
        code,
        error: error instanceof Error ? error.message : String(error),
      })
      try {
        await this.repository.failGeneration(userId, executionAt, code)
      } catch (cleanupError) {
        this.log.warn('Insight report generation cleanup failed', {
          userId,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        })
      }
      return code === 'timed_out' ? 'timed_out' : 'failed'
    }
  }

  /** Compatibility wrapper for the current synchronous refresh workflow. */
  async refresh(userId: string): Promise<InsightReportStatus> {
    const start = await this.tryStart(userId, { manual: true })
    if (start.status === 'claimed') return this.generateClaimedReport(userId, start.claimedAt)
    if (start.status === 'not_enough_entries') return 'insufficient_entries'
    if (start.status === 'cooldown') return 'cooldown'
    return 'refresh_in_progress'
  }
}

export const insightReportService = new InsightReportService()
