import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { PersonalityInsights } from '@/components/insights/personality-insights'
import { getServerSession } from '@/src/server/auth/session'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Personality' }
// Server-prefetch can claim deferred work directly, so it needs the same background budget as tRPC.
export const maxDuration = 300

export default async function PersonalityPage() {
  const queryClient = getQueryClient()
  const session = await getServerSession()
  const options = trpc.v1.insights.personality.queryOptions()
  const queryKey = [...options.queryKey, session!.user.id] as unknown as typeof options.queryKey
  await queryClient.prefetchQuery({ ...options, queryKey })

  return (
    <Page>
      <InsightsHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PersonalityInsights userId={session!.user.id} />
      </HydrationBoundary>
    </Page>
  )
}
