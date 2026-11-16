import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { InsightReportOutputSchema } from '../../report-schema'
import { insightReportService } from '../../services/InsightReportService'
import { scheduleInsightReportGeneration } from '../../services/scheduleInsightReportGeneration'

export type StoredInsightReport = {
  recurringThemes: {
    title: string
    mentions: number
    trend: 'rising' | 'steady' | 'falling'
    entryIds: string[]
  }[]
  growthSuggestions: { title: string; body: string; short: string; entryIds: string[] }[]
  trendCaption: string | null
  periodStart: Date | null
  periodEnd: Date | null
  entryCount: number
  createdAt: Date
  generatedAt: Date
}

type InsightReportFields = Omit<StoredInsightReport, 'createdAt' | 'generatedAt'> & {
  createdAt: Date | null
  generatedAt: Date | null
}

export type InsightReportResponse = InsightReportFields & {
  status: 'ready' | 'updating' | 'notEnoughEntries'
  report: StoredInsightReport | null
  remainingEntries: number
  nextManualRefreshAt: Date | null
}

function nextManualRefreshAt(lastRefreshAt: Date | null): Date | null {
  return lastRefreshAt ? new Date(lastRefreshAt.getTime() + 24 * 60 * 60 * 1000) : null
}

function reportResponse(
  status: InsightReportResponse['status'],
  report: StoredInsightReport | null,
  remainingEntries: number,
  manualRefreshAt: Date | null,
): InsightReportResponse {
  const fields: InsightReportFields = report ?? {
    recurringThemes: [],
    growthSuggestions: [],
    trendCaption: null,
    periodStart: null,
    periodEnd: null,
    entryCount: 0,
    createdAt: null,
    generatedAt: null,
  }
  return {
    ...fields,
    status,
    report,
    remainingEntries,
    nextManualRefreshAt: nextManualRefreshAt(manualRefreshAt),
  }
}

/** Returns the saved report immediately and starts stale report regeneration after the response. */
export const report = protectedProcedure.query(async ({ ctx }): Promise<InsightReportResponse> => {
  const stored = await prisma.insightReport.findUnique({
    where: { userId: ctx.user.id },
    select: {
      recurringThemes: true,
      growthSuggestions: true,
      trendCaption: true,
      periodStart: true,
      periodEnd: true,
      entryCount: true,
      createdAt: true,
      generatedAt: true,
      generatingAt: true,
      lastRefreshAt: true,
    },
  })

  const stale = await insightReportService.isStale(ctx.user.id)
  const start = stale ? await insightReportService.tryStart(ctx.user.id) : null
  if (start?.status === 'claimed') {
    scheduleInsightReportGeneration(ctx.user.id, start.claimedAt)
  }

  let savedReport: StoredInsightReport | null = null
  if (stored?.generatedAt) {
    const parsed = InsightReportOutputSchema.safeParse({
      recurringThemes: stored.recurringThemes,
      growthSuggestions: stored.growthSuggestions,
      trendCaption: stored.trendCaption,
    })
    if (parsed.success) {
      savedReport = {
        recurringThemes: parsed.data.recurringThemes,
        growthSuggestions: parsed.data.growthSuggestions,
        trendCaption: parsed.data.trendCaption,
        periodStart: stored.periodStart,
        periodEnd: stored.periodEnd,
        entryCount: stored.entryCount,
        createdAt: stored.createdAt,
        generatedAt: stored.generatedAt,
      }
    }
  }

  if (start?.status === 'not_enough_entries' || (!stored?.generatedAt && !stale)) {
    return reportResponse(
      'notEnoughEntries',
      savedReport,
      start?.status === 'not_enough_entries'
        ? start.missingEntries
        : await insightReportService.remainingEntries(ctx.user.id),
      stored?.lastRefreshAt ?? null,
    )
  }

  if (
    start?.status === 'claimed' ||
    start?.status === 'refresh_in_progress' ||
    stored?.generatingAt
  ) {
    return reportResponse('updating', savedReport, 0, stored?.lastRefreshAt ?? null)
  }

  return reportResponse('ready', savedReport, 0, stored?.lastRefreshAt ?? null)
})
