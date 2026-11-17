import type { ReactNode } from 'react'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell/app-shell'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { PATHNAME_HEADER, STALE_SESSION_PARAM } from '@/src/lib/auth/redirect'
import { getServerSession } from '@/src/server/auth/session'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

// Authoritative session check. `proxy.ts` only checks that the cookie exists, so an expired
// or revoked session gets this far. The stale flag stops the proxy bouncing /login back here,
// and the proxy-forwarded path lets the user return to this page after signing in.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession()

  if (!session) {
    const params = new URLSearchParams({ [STALE_SESSION_PARAM]: '1' })
    const pathname = (await headers()).get(PATHNAME_HEADER)
    if (pathname) params.set('redirect', pathname)
    redirect(`/login?${params}`)
  }

  // Start the streak query without waiting for it: the pending query is dehydrated and streams to
  // the pill, so the shell renders right away (see `shouldDehydrateQuery` in query-client.ts).
  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(trpc.v1.entry.stats.queryOptions({ timeZone: APP_TIME_ZONE }))

  const user = { name: session.user.name, email: session.user.email }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell user={user}>{children}</AppShell>
    </HydrationBoundary>
  )
}
