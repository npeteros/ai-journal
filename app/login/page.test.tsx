import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/auth/login-form', () => ({
  LoginForm: ({ redirectTo }: { redirectTo: string }) => <p data-testid="redirect">{redirectTo}</p>,
}))
vi.mock('@/components/auth/auth-split-layout', () => ({
  AuthSplitLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { default: LoginPage } = await import('./page')

async function renderWith(searchParams: Record<string, string | string[] | undefined>) {
  const ui = await LoginPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as PageProps<'/login'>)
  render(ui)
  return screen.getByTestId('redirect').textContent
}

describe('LoginPage', () => {
  it('passes a same-origin redirect through to the form', async () => {
    expect(await renderWith({ redirect: '/chat/1?tab=a' })).toBe('/chat/1?tab=a')
  })

  it.each(['https://evil.com', '//evil.com'])('ignores external redirect %s', async (redirect) => {
    expect(await renderWith({ redirect })).toBe('/journal')
  })

  it('defaults to /journal without a redirect param', async () => {
    expect(await renderWith({})).toBe('/journal')
  })
})
