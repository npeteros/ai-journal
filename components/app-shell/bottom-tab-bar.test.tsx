import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ pathname: '/journal' }))

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }))

const { BottomTabBar } = await import('./bottom-tab-bar')

const linkNames = () =>
  within(screen.getByRole('navigation', { name: 'Primary' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent)

describe('BottomTabBar', () => {
  beforeEach(() => {
    mocks.pathname = '/journal'
  })

  it('puts New entry in the centre and leaves Settings out', () => {
    render(<BottomTabBar />)
    expect(linkNames()).toEqual(['Journal', 'Frameworks', 'New entry', 'Insights', 'Chat'])
    expect(screen.getByRole('link', { name: 'New entry' }).getAttribute('href')).toBe(
      '/journal/new',
    )
  })

  it('marks the current section as active', () => {
    mocks.pathname = '/insights/story'
    render(<BottomTabBar />)
    expect(screen.getByRole('link', { name: 'Insights' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Journal' }).getAttribute('aria-current')).toBeNull()
  })

  it('gives /journal/new to the New button, not the Journal tab', () => {
    mocks.pathname = '/journal/new'
    render(<BottomTabBar />)
    expect(screen.getByRole('link', { name: 'New entry' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('link', { name: 'Journal' }).getAttribute('aria-current')).toBeNull()
  })
})
