// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prefetchQuery: vi.fn(),
  statsQueryOptions: vi.fn((input: unknown) => ({ queryKey: ['v1.entry.stats', input] })),
  profileQueryOptions: vi.fn(() => ({ queryKey: ['v1.profile.get'] })),
  headers: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/src/server/auth/session', () => ({ getServerSession: mocks.getSession }))
vi.mock('@/src/server/trpc/server', () => ({
  getQueryClient: () => ({ prefetchQuery: mocks.prefetchQuery }),
  trpc: {
    v1: {
      entry: { stats: { queryOptions: mocks.statsQueryOptions } },
      profile: { get: { queryOptions: mocks.profileQueryOptions } },
    },
  },
}))
vi.mock('@tanstack/react-query', () => ({
  dehydrate: () => ({}),
  HydrationBoundary: ({ children }: { children: unknown }) => children,
}))
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
    const shell = result.props.children
    expect(shell.props.children).toBe('page')
    expect(shell.props.user).toEqual({ name: 'Maya Chen', email: 'maya@example.com' })
  })

  it('prefetches the streak in the app time zone', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Maya', email: 'm@x.co' } })
    await AppLayout({ children: 'page' })
    expect(mocks.statsQueryOptions).toHaveBeenCalledWith({ timeZone: 'Asia/Manila' })
    expect(mocks.prefetchQuery).toHaveBeenCalledWith({
      queryKey: ['v1.entry.stats', { timeZone: 'Asia/Manila' }],
    })
  })

  it('prefetches the onboarding state for the welcome card and tour', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Maya', email: 'm@x.co' } })
    await AppLayout({ children: 'page' })
    expect(mocks.prefetchQuery).toHaveBeenCalledWith({ queryKey: ['v1.profile.get'] })
  })

  it('does not prefetch when the session is stale', async () => {
    mocks.getSession.mockResolvedValue(null)
    await expect(AppLayout({ children: 'page' })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.prefetchQuery).not.toHaveBeenCalled()
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
