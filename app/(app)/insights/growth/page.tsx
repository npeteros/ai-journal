import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import {
  GrowthSuggestions,
  InsightReportProvider,
  InsightReportStatus,
} from '@/components/insights/insight-report'
import { InsightsHeader } from '@/components/insights/insights-header'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Growth' }

export default async function GrowthPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(trpc.v1.insights.report.queryOptions())

  return (
    <Page>
      <InsightsHeader />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <InsightReportProvider>
          <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
            A few gentle suggestions based on what you&apos;ve been writing about lately.
          </p>
          <div className="mt-5">
            <InsightReportStatus />
          </div>
          <div className="mt-16">
            <GrowthSuggestions />
          </div>
        </InsightReportProvider>
      </HydrationBoundary>
    </Page>
  )
}
