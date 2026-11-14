import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { EmotionalTrendCard } from '@/components/insights/emotional-trend-card'
import {
  ForYouSuggestion,
  InsightReportProvider,
  InsightReportStatus,
  RecurringThemes,
} from '@/components/insights/insight-report'
import { InsightsHeader } from '@/components/insights/insights-header'
import { Rise } from '@/components/motion'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Deeper insights' }

export default async function DeeperInsightsPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(trpc.v1.insights.report.queryOptions())

  return (
    <Page>
      <InsightsHeader />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <InsightReportProvider>
          <div className="mb-5">
            <InsightReportStatus />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-5">
              <Rise>
                <EmotionalTrendCard />
              </Rise>

              <Rise i={1}>
                <RecurringThemes />
              </Rise>
              <p className="text-[12px] text-neutral-400">
                Generated from your entries via cloud AI. Logged in your{' '}
                <Link
                  href="/settings/data-privacy"
                  className="font-semibold text-cloud-700 hover:underline"
                >
                  Processing Log
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <Rise i={2}>
                <ForYouSuggestion />
              </Rise>
            </div>
          </div>
        </InsightReportProvider>
      </HydrationBoundary>
    </Page>
  )
}
