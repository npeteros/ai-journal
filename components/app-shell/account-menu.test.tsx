import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/src/lib/auth-client', () => ({ signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

const { MobileTopBar } = await import('./mobile-top-bar')
const { fullPageNavigation } = await import('./use-sign-out')

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient()
  // Stands in for a signed-in user's cached data, which sign-out must drop.
  queryClient.setQueryData(['signed-in-data'], { private: true })
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  }
}

const user = { name: 'Maya Chen', email: 'maya@example.com' }

describe('MobileTopBar account menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(fullPageNavigation, 'assign').mockImplementation(() => undefined)
  })

  it('shows the logo and the account avatar', () => {
    renderWithClient(<MobileTopBar user={user} />)
    expect(screen.getByRole('link', { name: 'JADEN home' })).toBeTruthy()
    expect(within(screen.getByRole('button', { name: 'Account' })).getByText('MC')).toBeTruthy()
  })

  it('opens a sheet with the user, Settings and Sign out', async () => {
    renderWithClient(<MobileTopBar user={user} />)
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Maya Chen')).toBeTruthy()
    expect(within(sheet).getByText('maya@example.com')).toBeTruthy()
    expect(within(sheet).getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe(
      '/settings',
    )
  })

  it('signs out from the sheet and goes to /login', async () => {
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null })
    const { queryClient } = renderWithClient(<MobileTopBar user={user} />)
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(fullPageNavigation.assign).toHaveBeenCalledWith('/login'))
    expect(queryClient.getQueryData(['signed-in-data'])).toBeUndefined()
  })
})
