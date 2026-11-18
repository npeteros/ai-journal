import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { PersonalityInsights } from '@/components/insights/personality-insights'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Personality' }
// Server-prefetch can claim deferred work directly, so it needs the same background budget as tRPC.
export const maxDuration = 300

export default function PersonalityPage() {
  // Not awaited: the pending query streams to the client, which shows its own loading state.
  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(trpc.v1.insights.personality.queryOptions())

  return (
    <Page>
      <InsightsHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PersonalityInsights />
      </HydrationBoundary>
    </Page>
  )
}
