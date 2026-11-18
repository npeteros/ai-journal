import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { StoryView } from '@/components/insights/story-view'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Story' }

export default async function StoryPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchInfiniteQuery(
    trpc.v1.insights.story.infiniteQueryOptions(
      { timeZone: APP_TIME_ZONE },
      { getNextPageParam: (page) => page.nextCursor },
    ),
  )

  return (
    <Page tone="dusk">
      <InsightsHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <StoryView />
      </HydrationBoundary>
    </Page>
  )
}
