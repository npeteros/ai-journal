// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/components/app-shell/app-shell', () => ({
  AppShell: ({ children }: { children: unknown }) => children,
}))

const { default: AppLayout } = await import('./layout')

function redirectTarget() {
  const url = mocks.redirect.mock.calls[0]?.[0]
  return url ? new URL(url, 'http://localhost') : null
}

describe('(app) layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headers.mockResolvedValue(new Headers())
  })

  it('renders children with the session user when the session is valid', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user-1', name: 'Maya Chen', email: 'maya@example.com' },
    })
    const result = await AppLayout({ children: 'page' })
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(result.props.children).toBe('page')
    expect(result.props.user).toEqual({ name: 'Maya Chen', email: 'maya@example.com' })
  })

  it('passes the request headers to getSession', async () => {
    const reqHeaders = new Headers({ cookie: 'better-auth.session_token=abc' })
    mocks.headers.mockResolvedValue(reqHeaders)
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    await AppLayout({ children: 'page' })
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: reqHeaders })
  })

  it('redirects a stale session to /login with the stale flag and original path', async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-pathname': '/chat/1?tab=a' }))
    mocks.getSession.mockResolvedValue(null)

    await expect(AppLayout({ children: 'page' })).rejects.toThrow('NEXT_REDIRECT')
    const url = redirectTarget()
    expect(url?.pathname).toBe('/login')
    expect(url?.searchParams.get('stale')).toBe('1')
    expect(url?.searchParams.get('redirect')).toBe('/chat/1?tab=a')
  })

  it('omits the redirect param when the path header is missing', async () => {
    mocks.getSession.mockResolvedValue(null)

    await expect(AppLayout({ children: 'page' })).rejects.toThrow('NEXT_REDIRECT')
    const url = redirectTarget()
    expect(url?.searchParams.get('stale')).toBe('1')
    expect(url?.searchParams.has('redirect')).toBe(false)
  })
})
