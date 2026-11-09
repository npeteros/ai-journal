import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

import { DEFAULT_AFTER_LOGIN, PATHNAME_HEADER, STALE_SESSION_PARAM } from '@/src/lib/auth/redirect'

const PROTECTED_PREFIXES = ['/journal', '/chat', '/frameworks', '/insights', '/settings']
const AUTH_PAGES = ['/login', '/register']

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/**
 * Optimistic auth redirects based only on the presence of the session cookie (no DB call).
 * The authoritative check lives in `app/(app)/layout.tsx`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  const hasSession = !!getSessionCookie(request)

  if (matches(pathname, PROTECTED_PREFIXES)) {
    if (!hasSession) {
      const url = new URL('/login', request.url)
      url.searchParams.set('redirect', `${pathname}${search}`)
      return NextResponse.redirect(url)
    }

    const headers = new Headers(request.headers)
    headers.set(PATHNAME_HEADER, `${pathname}${search}`)
    return NextResponse.next({ request: { headers } })
  }

  if (hasSession && matches(pathname, AUTH_PAGES) && !searchParams.has(STALE_SESSION_PARAM)) {
    return NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url))
  }

  return NextResponse.next()
}

// Only guarded routes are matched, so `/`, `/api/*`, `_next` and static assets never hit the proxy.
export const config = {
  matcher: [
    '/journal/:path*',
    '/chat/:path*',
    '/frameworks/:path*',
    '/insights/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
}
