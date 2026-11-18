import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PersonalityInsights,
  type PersonalityData,
  PERSONALITY_POLL_TIMEOUT_MS,
  PREPARING_STEPS,
  nextPersonalityPollInterval,
} from './personality-insights'

const ENTRY_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_ENTRY_ID = '00000000-0000-4000-8000-000000000002'

// tRPC's real unprefixed key shape: [path, { type }]. A key of 3+ elements is parsed as prefixed
// and breaks the query function, so the component must use this key unchanged.
const QUERY_KEY = [['v1', 'insights', 'personality'], { type: 'query' }]

const mocks = vi.hoisted(() => ({ personality: vi.fn() }))

vi.mock('@/components/chat/entry-preview-panel', () => ({
  EntryPreviewPanel: ({ entry, label }: { entry: { title: string } | null; label?: string }) =>
    entry ? (
      <dialog open>
        {label}: {entry.title}
      </dialog>
    ) : null,
}))

vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      insights: {
        personality: {
          queryOptions: () => ({ queryKey: QUERY_KEY, queryFn: mocks.personality }),
        },
      },
    },
  }),
}))

function response(overrides: Partial<PersonalityData> = {}): PersonalityData {
  return {
    status: 'ready' as const,
    remainingEntries: 0,
    retryAfter: null,
    unavailable: false,
    profile: {
      basedOn: 22,
      generatedAt: '2026-11-18T12:00:00.000Z',
      summary: 'Your writing returns to curiosity and considered connection.',
      meaning: 'The patterns here are a starting point for your own reflection.',
      traits: [
        {
          trait: 'openness',
          label: 'Openness',
          score: 76,
          level: 'High',
          evidence: [
            { id: ENTRY_ID, title: 'Morning pages', entryDate: '2026-11-01T00:00:00.000Z' },
          ],
        },
        {
          trait: 'conscientiousness',
          label: 'Conscientiousness',
          score: 58,
          level: 'Moderate',
          evidence: [
            {
              id: SECOND_ENTRY_ID,
              title: 'Dinner with Sam',
              entryDate: '2026-11-05T00:00:00.000Z',
            },
          ],
        },
        {
          trait: 'extraversion',
          label: 'Extraversion',
          score: 33,
          level: 'Low',
          evidence: [
            { id: ENTRY_ID, title: 'Morning pages', entryDate: '2026-11-01T00:00:00.000Z' },
          ],
        },
        {
          trait: 'agreeableness',
          label: 'Agreeableness',
          score: 67,
          level: 'High',
          evidence: [
            {
              id: SECOND_ENTRY_ID,
              title: 'Dinner with Sam',
              entryDate: '2026-11-05T00:00:00.000Z',
            },
          ],
        },
        {
          trait: 'neuroticism',
          label: 'Emotional stability',
          score: 70,
          level: 'High',
          evidence: [
            { id: ENTRY_ID, title: 'Morning pages', entryDate: '2026-11-01T00:00:00.000Z' },
          ],
        },
      ],
    },
    ...overrides,
  }
}

function renderInsights(data: PersonalityData | null = response()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (data) queryClient.setQueryData(QUERY_KEY, data)
  return render(
    <QueryClientProvider client={queryClient}>
      <PersonalityInsights />
    </QueryClientProvider>,
  )
}

describe('Personality insights UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a hydrated ready profile without a loading placeholder or duplicate request', () => {
    renderInsights()

    expect(screen.getByText('The Big Five')).toBeTruthy()
    expect(screen.getByText(/Emotional stability High/)).toBeTruthy()
    expect(screen.getByText(/AI reflection of patterns/i)).toBeTruthy()
    expect(screen.queryByText('Preparing your reflection')).toBeNull()
    expect(mocks.personality).not.toHaveBeenCalled()
  })

  it('keeps evidence collapsed per trait and opens the shared entry preview, not a new page', () => {
    renderInsights()

    expect(screen.queryByRole('button', { name: /Morning pages/ })).toBeNull()
    const openness = screen.getByRole('button', { name: /^Openness/ })
    expect(openness.textContent).toContain('1 entry')

    fireEvent.click(openness)
    const chip = screen.getByRole('button', { name: /Morning pages/ })
    expect(screen.queryByRole('link', { name: /Morning pages/ })).toBeNull()

    fireEvent.click(chip)
    expect(screen.getByRole('dialog').textContent).toBe('Cited for Openness: Morning pages')
  })

  it('explains each Big Five trait in a popover, without adding to the page by default', () => {
    renderInsights()

    expect(screen.queryByText(/Where you get your energy/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /What are these/ }))

    expect(screen.getByText(/Where you get your energy/)).toBeTruthy()
    expect(screen.getByText('recharged by quiet and time alone')).toBeTruthy()
    expect(screen.getByText('recharged by people and activity')).toBeTruthy()
  })

  it('shows a loading state, not an unavailable message, while the streamed query is pending', () => {
    mocks.personality.mockReturnValue(new Promise(() => undefined))
    renderInsights(null)

    expect(screen.getByLabelText('Loading reflection')).toBeTruthy()
    expect(screen.queryByText('Reflection unavailable')).toBeNull()
  })

  it('removes an invalidated profile immediately when entries are insufficient', () => {
    renderInsights(response({ status: 'notEnoughEntries', profile: null, remainingEntries: 3 }))

    expect(screen.getByText(/You have 17 analyzed entries/i)).toBeTruthy()
    expect(screen.getByText(/Add 3 more entries/i)).toBeTruthy()
    expect(screen.queryByText('The Big Five')).toBeNull()
  })

  it('keeps a safe profile visible during background regeneration', async () => {
    renderInsights(response({ status: 'updating' }))

    expect(screen.getByText('The Big Five')).toBeTruthy()
    expect(await screen.findByText('Updating reflection...')).toBeTruthy()
  })

  it('shows a live preparing state while the first reflection generates', () => {
    renderInsights(response({ status: 'updating', profile: null, unavailable: true }))

    expect(screen.getByText('Preparing your reflection')).toBeTruthy()
    expect(screen.getByText(PREPARING_STEPS[0])).toBeTruthy()
    expect(screen.getByText(/Your reflection is being prepared/)).toBeTruthy()
    expect(screen.queryByText(/Check back shortly/)).toBeNull()
  })

  it('uses a friendly unavailable state during a retry cooldown', () => {
    renderInsights(
      response({
        profile: null,
        retryAfter: '2026-11-18T12:05:00.000Z',
        unavailable: true,
      }),
    )

    expect(screen.getByText('Reflection unavailable')).toBeTruthy()
    expect(screen.queryByText('The Big Five')).toBeNull()
  })

  it('polls only active non-cooldown work and stops at the generation lease bound', () => {
    const updating = response({ status: 'updating' })
    expect(nextPersonalityPollInterval(updating, 0, 1)).toBe(4_000)
    // A run may take up to the three-minute model deadline; polling must outlast it.
    expect(nextPersonalityPollInterval(updating, 0, 3 * 60 * 1_000)).toBe(4_000)
    expect(nextPersonalityPollInterval(updating, 0, PERSONALITY_POLL_TIMEOUT_MS)).toBe(false)
    expect(nextPersonalityPollInterval(response(), 0, 1)).toBe(false)
    expect(
      nextPersonalityPollInterval(response({ status: 'updating', retryAfter: 'future' }), 0, 1),
    ).toBe(false)
  })
})
