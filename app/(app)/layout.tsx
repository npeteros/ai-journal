import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell/app-shell'
import { PATHNAME_HEADER, STALE_SESSION_PARAM } from '@/src/lib/auth/redirect'
import { placeholderUser } from '@/src/lib/placeholder/user'
import { auth } from '@/src/server/auth/auth'

// Authoritative session check. `proxy.ts` only checks that the cookie exists, so an expired
// or revoked session gets this far. The stale flag stops the proxy bouncing /login back here,
// and the proxy-forwarded path lets the user return to this page after signing in.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) {
    const params = new URLSearchParams({ [STALE_SESSION_PARAM]: '1' })
    const pathname = requestHeaders.get(PATHNAME_HEADER)
    if (pathname) params.set('redirect', pathname)
    redirect(`/login?${params}`)
  }

  const user = { name: session.user.name, email: session.user.email }

  return (
    <AppShell streakDays={placeholderUser.streakDays} user={user}>
      {children}
    </AppShell>
  )
}
