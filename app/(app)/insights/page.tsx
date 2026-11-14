import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { InsightReportProvider, InsightReportStatus } from '@/components/insights/insight-report'
import { InsightsOverview } from '@/components/insights/insights-overview'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Insights' }

export default async function InsightsOverviewPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(trpc.v1.insights.report.queryOptions())

  return (
    <Page>
      <InsightsHeader />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <InsightReportProvider>
          <div className="mt-[104px] flex flex-col gap-5 lg:mt-[88px]">
            <InsightReportStatus />
            <InsightsOverview />
          </div>
        </InsightReportProvider>
      </HydrationBoundary>
    </Page>
  )
}
