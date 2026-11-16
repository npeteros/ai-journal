import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    clearError: vi.fn(),
    status: 'ready',
    error: undefined,
  }),
}))
vi.mock('@/components/jaden', () => ({
  JadenFor: () => null,
  JadenPerch: ({ children }: { children: ReactNode }) => children,
  PLACEMENTS: { chat: { size: 80 } },
  belowEdge: () => 0,
  heightFor: () => 0,
}))
vi.mock('./entry-preview-panel', () => ({ EntryPreviewPanel: () => null }))

// jsdom doesn't implement scrollIntoView, which the chat calls on mount.
Element.prototype.scrollIntoView = vi.fn()

const { JournalChat } = await import('./journal-chat')

describe('JournalChat', () => {
  it('offers a shortcut to voice journaling next to the chat input', () => {
    render(<JournalChat />)

    const link = screen.getByRole('link', { name: /talk with jaden instead/i })
    expect(link.getAttribute('href')).toBe('/journal/voice')
  })
})
