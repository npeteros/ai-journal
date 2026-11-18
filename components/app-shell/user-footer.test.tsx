import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const { UserFooter } = await import('./user-footer')
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
const { initialsFor } = await import('./user-avatar')

const user = { name: 'Maya Chen', email: 'maya@example.com' }

describe('initialsFor', () => {
  it.each([
    [{ name: 'Maya Chen', email: 'm@x.com' }, 'MC'],
    [{ name: 'maya', email: 'm@x.com' }, 'M'],
    [{ name: '  Maya  Lin  Chen ', email: 'm@x.com' }, 'MC'],
    [{ name: '', email: 'zoe@x.com' }, 'Z'],
  ])('%j -> %s', (u, expected) => {
    expect(initialsFor(u)).toBe(expected)
  })
})

describe('UserFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(fullPageNavigation, 'assign').mockImplementation(() => undefined)
  })

  it('shows the signed-in user', () => {
    renderWithClient(<UserFooter user={user} />)
    expect(screen.getByText('Maya Chen')).toBeTruthy()
    expect(screen.getByText('maya@example.com')).toBeTruthy()
    expect(screen.getByText('MC')).toBeTruthy()
  })

  it('signs out and goes to /login', async () => {
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null })
    const { queryClient } = renderWithClient(<UserFooter user={user} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(fullPageNavigation.assign).toHaveBeenCalledWith('/login'))
    expect(queryClient.getQueryData(['signed-in-data'])).toBeUndefined()
  })

  it('shows an error and re-enables the button when sign out fails', async () => {
    mocks.signOut.mockResolvedValue({ data: null, error: { message: 'Network down' } })
    renderWithClient(<UserFooter user={user} />)

    const button = screen.getByRole('button', { name: 'Sign out' })
    fireEvent.click(button)

    expect((await screen.findByRole('alert')).textContent).toBe('Network down')
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(fullPageNavigation.assign).not.toHaveBeenCalled()
  })
})
