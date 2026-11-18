import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PersonalityInsights,
  type PersonalityData,
  PERSONALITY_POLL_TIMEOUT_MS,
  nextPersonalityPollInterval,
} from './personality-insights'

const ENTRY_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_ENTRY_ID = '00000000-0000-4000-8000-000000000002'

const mocks = vi.hoisted(() => ({ personality: vi.fn() }))

vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      insights: {
        personality: {
          queryOptions: () => ({ queryKey: ['personality'], queryFn: mocks.personality }),
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
          evidenceEntryIds: [ENTRY_ID],
        },
        {
          trait: 'conscientiousness',
          label: 'Conscientiousness',
          score: 58,
          level: 'Moderate',
          evidenceEntryIds: [SECOND_ENTRY_ID],
        },
        {
          trait: 'extraversion',
          label: 'Extraversion',
          score: 33,
          level: 'Low',
          evidenceEntryIds: [ENTRY_ID],
        },
        {
          trait: 'agreeableness',
          label: 'Agreeableness',
          score: 67,
          level: 'High',
          evidenceEntryIds: [SECOND_ENTRY_ID],
        },
        {
          trait: 'neuroticism',
          label: 'Emotional stability',
          score: 70,
          level: 'High',
          evidenceEntryIds: [ENTRY_ID],
        },
      ],
    },
    ...overrides,
  }
}

function renderInsights(data = response(), userId = 'user-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(['personality', userId], data)
  return render(
    <QueryClientProvider client={queryClient}>
      <PersonalityInsights userId={userId} />
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

  it('links only API-provided evidence to the journal', () => {
    renderInsights()
    const links = screen.getAllByRole('link', { name: /Journal entry/i })

    expect(links).toHaveLength(2)
    expect(links[0]?.getAttribute('href')).toBe(`/journal/${ENTRY_ID}`)
    expect(links[1]?.getAttribute('href')).toBe(`/journal/${SECOND_ENTRY_ID}`)
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

  it('polls only active non-cooldown work and stops at the two-minute bound', () => {
    const updating = response({ status: 'updating' })
    expect(nextPersonalityPollInterval(updating, 0, 1)).toBe(4_000)
    expect(nextPersonalityPollInterval(updating, 0, PERSONALITY_POLL_TIMEOUT_MS)).toBe(false)
    expect(nextPersonalityPollInterval(response(), 0, 1)).toBe(false)
    expect(
      nextPersonalityPollInterval(response({ status: 'updating', retryAfter: 'future' }), 0, 1),
    ).toBe(false)
  })

  it('uses separate hydrated caches for separate authenticated users', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(['personality', 'user-1'], response())
    queryClient.setQueryData(
      ['personality', 'user-2'],
      response({ profile: null, unavailable: true }),
    )

    render(
      <QueryClientProvider client={queryClient}>
        <PersonalityInsights userId="user-2" />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Reflection unavailable')).toBeTruthy()
    expect(screen.queryByText('The Big Five')).toBeNull()
  })

  it('does not retain a prior user profile while a new authenticated user query loads', () => {
    mocks.personality.mockReturnValue(new Promise(() => undefined))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(['personality', 'user-1'], response())
    const rendered = render(
      <QueryClientProvider client={queryClient}>
        <PersonalityInsights userId="user-1" />
      </QueryClientProvider>,
    )

    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <PersonalityInsights userId="user-2" />
      </QueryClientProvider>,
    )
    expect(screen.queryByText('The Big Five')).toBeNull()
  })
})
