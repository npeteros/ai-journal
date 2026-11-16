import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  beforeEach(() => vi.clearAllMocks())

  it('shows the signed-in user', () => {
    render(<UserFooter user={user} />)
    expect(screen.getByText('Maya Chen')).toBeTruthy()
    expect(screen.getByText('maya@example.com')).toBeTruthy()
    expect(screen.getByText('MC')).toBeTruthy()
  })

  it('signs out and goes to /login', async () => {
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null })
    render(<UserFooter user={user} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/login'))
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('shows an error and re-enables the button when sign out fails', async () => {
    mocks.signOut.mockResolvedValue({ data: null, error: { message: 'Network down' } })
    render(<UserFooter user={user} />)

    const button = screen.getByRole('button', { name: 'Sign out' })
    fireEvent.click(button)

    expect((await screen.findByRole('alert')).textContent).toBe('Network down')
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
