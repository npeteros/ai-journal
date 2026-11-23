import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CHAT_RATE_LIMITED_MESSAGE } from '@/src/lib/chat'
import { CompanionPanel, ENTRY_CAP_NOTE } from './companion-panel'

function renderPanel(props: Partial<ComponentProps<typeof CompanionPanel>> = {}) {
  const handlers = { onAskAnother: vi.fn(), onDismiss: vi.fn() }
  render(
    <CompanionPanel
      question={null}
      asking={false}
      note={null}
      coolingDown={false}
      ready
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('CompanionPanel', () => {
  it('shows the question quietly with Another question and Dismiss', () => {
    const { onAskAnother, onDismiss } = renderPanel({ question: 'What changed after lunch?' })

    const question = screen.getByText('What changed after lunch?')
    expect(question.closest('[aria-live="polite"]')).not.toBeNull()
    expect(document.activeElement).toBe(document.body)

    fireEvent.click(screen.getByRole('button', { name: 'Another question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onAskAnother).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('disables asking during the cooldown, while asking, and before the entry is saved', () => {
    for (const props of [{ coolingDown: true }, { asking: true }, { ready: false }]) {
      const { unmount } = render(
        <CompanionPanel
          question={null}
          asking={false}
          note={null}
          coolingDown={false}
          ready
          onAskAnother={vi.fn()}
          onDismiss={vi.fn()}
          {...props}
        />,
      )
      expect(screen.getByRole('button', { name: 'Ask a question' })).toHaveProperty(
        'disabled',
        true,
      )
      unmount()
    }
  })

  it('replaces the question with a short note when over the limit', () => {
    renderPanel({ question: 'Hidden?', note: 'limited' })

    expect(screen.queryByText(CHAT_RATE_LIMITED_MESSAGE)).not.toBeNull()
    expect(screen.queryByText('Hidden?')).toBeNull()
    expect(screen.queryByRole('button', { name: /question|Dismiss/ })).toBeNull()
  })

  it('shows a note once the entry has had its questions', () => {
    renderPanel({ note: 'entry_cap' })

    expect(screen.queryByText(ENTRY_CAP_NOTE)).not.toBeNull()
  })
})
