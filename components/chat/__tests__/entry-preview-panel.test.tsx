import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EntryPreviewPanel } from '../entry-preview-panel'

const ENTRY = { id: 'entry-1', title: 'Walk by the river', date: '2026-10-28' }

vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      entry: {
        findOne: {
          queryOptions: ({ id }: { id: string }) => ({
            queryKey: ['entry', id],
            queryFn: () => new Promise(() => undefined),
          }),
        },
      },
    },
  }),
}))

function renderPanel(label?: string, analysis: unknown = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['entry', ENTRY.id], {
    id: ENTRY.id,
    title: ENTRY.title,
    body: 'Took a long walk at lunch.',
    writtenAt: '2026-10-28T11:55:00.000Z',
    tags: [{ id: 'tag-1', name: 'Outdoors' }],
    analysis,
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <EntryPreviewPanel entry={ENTRY} label={label} onClose={() => undefined} />
    </QueryClientProvider>,
  )
}

describe('EntryPreviewPanel', () => {
  it('says why the entry is shown, defaulting to a generic citation label', () => {
    const { unmount } = renderPanel()
    expect(screen.getByText('Cited entry')).toBeTruthy()
    unmount()

    renderPanel('Cited for Extraversion')
    expect(screen.getByText('Cited for Extraversion')).toBeTruthy()
  })

  it("shows the entry's mood and JADEN's read alongside the entry text", () => {
    renderPanel('Cited for Openness', {
      mood: 'calm',
      moodScore: 72,
      summary: ['Found calm on a lunchtime walk.'],
      themes: ['Nature'],
      suggestedTags: [],
      analyzedAt: '2026-10-28T12:00:00.000Z',
    })

    expect(screen.getByText('Calm')).toBeTruthy()
    expect(screen.getByText("Jaden's read")).toBeTruthy()
    expect(screen.getByText('Found calm on a lunchtime walk.')).toBeTruthy()
    expect(screen.getByText('Nature')).toBeTruthy()
    expect(screen.getByText('Took a long walk at lunch.')).toBeTruthy()
  })

  it("omits JADEN's read for an entry without an analysis", () => {
    renderPanel()
    expect(screen.queryByText("Jaden's read")).toBeNull()
    expect(screen.getByText('Took a long walk at lunch.')).toBeTruthy()
  })
})
