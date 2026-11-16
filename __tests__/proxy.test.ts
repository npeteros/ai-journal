// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, proxy } from '@/proxy'

const ORIGIN = 'http://localhost:3000'

function request(path: string, { cookie = false } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', 'better-auth.session_token=abc.def')
  return new NextRequest(`${ORIGIN}${path}`, { headers })
}

const location = (res: Response) => res.headers.get('location')

describe('proxy', () => {
  it.each(['/journal', '/chat/123', '/frameworks/stoic', '/insights', '/settings/profile'])(
    'redirects logged-out visitors from %s to /login with a redirect param',
    (path) => {
      const res = proxy(request(path))
      expect(res.status).toBe(307)
      const url = new URL(location(res) ?? '')
      expect(url.pathname).toBe('/login')
      expect(url.searchParams.get('redirect')).toBe(path)
    },
  )

  it('keeps the query string in the redirect param', () => {
    const url = new URL(location(proxy(request('/chat/1?tab=a&x=2'))) ?? '')
    expect(url.searchParams.get('redirect')).toBe('/chat/1?tab=a&x=2')
  })

  it('does not treat lookalike prefixes as protected', () => {
    expect(location(proxy(request('/journaling')))).toBeNull()
  })

  it('lets requests with a session cookie through to app routes', () => {
    const res = proxy(request('/journal', { cookie: true }))
    expect(location(res)).toBeNull()
  })

  it('forwards the current path to the layout, overwriting any client value', () => {
    const req = request('/chat/1?tab=a', { cookie: true })
    req.headers.set('x-pathname', 'https://evil.com')
    const res = proxy(req)
    // NextResponse.next({ request: { headers } }) exposes overridden request headers this way.
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/chat/1?tab=a')
  })

  it.each(['/login', '/register'])('sends logged-in users from %s to /journal', (path) => {
    const res = proxy(request(path, { cookie: true }))
    expect(location(res)).toBe(`${ORIGIN}/journal`)
  })

  it('lets logged-out users reach /login and /register', () => {
    expect(location(proxy(request('/login')))).toBeNull()
    expect(location(proxy(request('/register')))).toBeNull()
  })

  it('lets a stale cookie reach /login when flagged by the layout', () => {
    expect(location(proxy(request('/login?stale=1', { cookie: true })))).toBeNull()
  })

  it('does not match the landing page, API routes or static assets', () => {
    for (const pattern of config.matcher) {
      expect(pattern).not.toBe('/')
      expect(pattern.startsWith('/api')).toBe(false)
      expect(pattern.startsWith('/_next')).toBe(false)
    }
  })
})
