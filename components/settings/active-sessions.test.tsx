import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActiveSessions } from './active-sessions'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}))

vi.mock('@/src/lib/auth-client', () => ({
  listSessions: mocks.listSessions,
  revokeSession: mocks.revokeSession,
  revokeOtherSessions: mocks.revokeOtherSessions,
  useSession: () => ({ data: { session: { id: 'current' } } }),
}))

function session(id: string) {
  return {
    id,
    token: `token-${id}`,
    userAgent: CHROME,
    ipAddress: '203.0.113.7',
    updatedAt: new Date().toISOString(),
  }
}

/** Resolves when `release` is called, so a sign-out can be held pending. */
function deferred() {
  let release: (value: { error: null | { message: string } }) => void = () => {}
  const promise = new Promise<{ error: null | { message: string } }>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function renderSessions() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ActiveSessions />
    </QueryClientProvider>,
  )
}

describe('ActiveSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listSessions.mockResolvedValue({
      data: [session('current'), session('a'), session('b')],
      error: null,
    })
  })

  it('disables only the row being signed out', async () => {
    const pending = deferred()
    mocks.revokeSession.mockReturnValue(pending.promise)
    renderSessions()

    const [first, second] = await screen.findAllByRole('button', { name: 'Sign out' })
    fireEvent.click(first)

    expect(
      (await screen.findByRole('button', { name: 'Signing out…' })).hasAttribute('disabled'),
    ).toBe(true)
    expect(second.hasAttribute('disabled')).toBe(false)

    await act(async () => pending.release({ error: null }))
  })

  it('clears an earlier sign-out error once a later action starts', async () => {
    mocks.revokeSession.mockResolvedValueOnce({ error: { message: 'Network down.' } })
    mocks.revokeOtherSessions.mockResolvedValue({ error: null })
    renderSessions()

    const [first] = await screen.findAllByRole('button', { name: 'Sign out' })
    fireEvent.click(first)
    expect((await screen.findByRole('alert')).textContent).toBe('Network down.')

    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all other sessions' }))

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(mocks.revokeOtherSessions).toHaveBeenCalledTimes(1)
  })
})
