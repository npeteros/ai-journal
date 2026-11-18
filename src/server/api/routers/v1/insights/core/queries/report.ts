import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { InsightReportOutputSchema } from '../../report-schema'
import { insightReportService } from '../../services/InsightReportService'
import { scheduleInsightReportGeneration } from '../../services/scheduleInsightReportGeneration'

export type ThemeEntry = { id: string; title: string; entryDate: Date }

export type StoredInsightReport = {
  recurringThemes: {
    title: string
    mentions: number
    trend: 'rising' | 'steady' | 'falling'
    entryIds: string[]
    /** The cited entries the user still has, for citation chips. */
    entries: ThemeEntry[]
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

/**
 * Titles and dates for the entries themes cite. Scoped to the user and skips deleted entries, so a
 * report generated before an entry was deleted never links to it.
 */
async function loadThemeEntries(userId: string, ids: string[]): Promise<Map<string, ThemeEntry>> {
  if (ids.length === 0) return new Map()
  const entries = await prisma.entry.findMany({
    where: { id: { in: [...new Set(ids)] }, userId, deletedAt: null },
    select: { id: true, title: true, entryDate: true },
  })
  return new Map(entries.map((entry) => [entry.id, entry]))
}

/** Returns the saved report immediately and starts stale report regeneration after the response. */
export const report = protectedProcedure.query(async ({ ctx }): Promise<InsightReportResponse> => {
  // `tryStart` checks staleness itself (and claims stale work), so it runs alongside the read of
  // the stored report. Whichever finishes first, a claim always reports `updating`.
  const [stored, start] = await Promise.all([
    prisma.insightReport.findUnique({
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
    }),
    insightReportService.tryStart(ctx.user.id),
  ])

  if (start.status === 'claimed') {
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
      const themeEntries = await loadThemeEntries(
        ctx.user.id,
        parsed.data.recurringThemes.flatMap((theme) => theme.entryIds),
      )
      savedReport = {
        recurringThemes: parsed.data.recurringThemes.map((theme) => ({
          ...theme,
          entries: theme.entryIds.flatMap((id) => {
            const entry = themeEntries.get(id)
            return entry ? [entry] : []
          }),
        })),
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

  if (start.status === 'not_enough_entries') {
    return reportResponse(
      'notEnoughEntries',
      savedReport,
      start.missingEntries,
      stored?.lastRefreshAt ?? null,
    )
  }

  if (
    start.status === 'claimed' ||
    start.status === 'refresh_in_progress' ||
    stored?.generatingAt
  ) {
    return reportResponse('updating', savedReport, 0, stored?.lastRefreshAt ?? null)
  }

  return reportResponse('ready', savedReport, 0, stored?.lastRefreshAt ?? null)
})
