import { protectedProcedure } from '@/src/server/trpc/init'
import { insightReportService } from '../../services/InsightReportService'
import { scheduleInsightReportGeneration } from '../../services/scheduleInsightReportGeneration'

function nextManualRefreshAt(lastRefreshAt: Date): Date {
  return new Date(lastRefreshAt.getTime() + 24 * 60 * 60 * 1000)
}

export const refresh = protectedProcedure.mutation(async ({ ctx }) => {
  const start = await insightReportService.tryStart(ctx.user.id, { manual: true })
  if (start.status === 'claimed') {
    scheduleInsightReportGeneration(ctx.user.id, start.claimedAt)
    return {
      status: 'refresh_in_progress' as const,
      remainingEntries: 0,
      nextManualRefreshAt: nextManualRefreshAt(start.claimedAt),
    }
  }

  if (start.status === 'not_enough_entries') {
    return {
      status: 'insufficient_entries' as const,
      remainingEntries: start.missingEntries,
      nextManualRefreshAt: null,
    }
  }

  if (start.status === 'cooldown') {
    return {
      status: 'cooldown' as const,
      remainingEntries: 0,
      nextManualRefreshAt: start.nextManualRefreshAt,
    }
  }
  return { status: 'refresh_in_progress' as const, remainingEntries: 0, nextManualRefreshAt: null }
})
