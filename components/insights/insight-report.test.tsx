import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GrowthSuggestions,
  InsightReportProvider,
  InsightReportStatus,
  INSIGHT_REPORT_POLL_TIMEOUT_MS,
  nextInsightReportPollInterval,
} from './insight-report'

const ENTRY_ID = '00000000-0000-4000-8000-000000000001'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  report: vi.fn(),
}))

vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      insights: {
        report: {
          queryOptions: () => ({ queryKey: ['insight-report'], queryFn: mocks.report }),
        },
        refresh: {
          mutationOptions: () => ({
            mutationKey: ['refresh-insight-report'],
            mutationFn: mocks.refresh,
          }),
        },
      },
    },
  }),
}))

function response(
  overrides: {
    remainingEntries?: number
    report?: {
      recurringThemes: {
        title: string
        mentions: number
        trend: 'rising' | 'steady' | 'falling'
        entryIds: string[]
      }[]
      growthSuggestions: { title: string; body: string; short: string; entryIds: string[] }[]
      trendCaption: string | null
    } | null
    status?: 'ready' | 'updating' | 'notEnoughEntries'
    nextManualRefreshAt?: string | null
  } = {},
) {
  return {
    status: 'ready' as const,
    remainingEntries: 0,
    nextManualRefreshAt: null,
    report: {
      recurringThemes: [],
      growthSuggestions: [
        {
          title: 'Protect a pause',
          body: 'A small transition after work may give you more room to reset.',
          short: 'Try a short transition after work.',
          entryIds: [ENTRY_ID],
        },
      ],
      trendCaption: 'Work boundaries appeared more often this month.',
    },
    ...overrides,
  }
}

function renderReport() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <InsightReportProvider>
        <InsightReportStatus />
        <GrowthSuggestions />
      </InsightReportProvider>
    </QueryClientProvider>,
  )
}

describe('Insight report UI', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mocks.report.mockResolvedValue(response())
    mocks.refresh.mockResolvedValue({
      status: 'refresh_in_progress',
      remainingEntries: 0,
      nextManualRefreshAt: '2026-08-27T12:00:00.000Z',
    })
  })

  it('keeps the growth area sized while the first report loads', () => {
    mocks.report.mockReturnValue(new Promise(() => undefined))

    renderReport()

    expect(screen.getByLabelText('Loading growth suggestions')).toBeTruthy()
  })

  it('keeps the saved suggestions visible while the report updates', async () => {
    mocks.report.mockResolvedValue(response({ status: 'updating' }))

    renderReport()

    expect(await screen.findByText('Updating your insights...')).toBeTruthy()
    expect(screen.getByText('Protect a pause')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Updating insights...' })).toBeTruthy()
  })

  it('starts a manual refresh without hiding the current report', async () => {
    renderReport()
    const button = await screen.findByRole('button', { name: 'Refresh insights' })

    fireEvent.click(button)

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(screen.getByText('Protect a pause')).toBeTruthy()
  })

  it('shows the cooldown state and prevents another manual refresh', async () => {
    const nextManualRefreshAt = new Date(Date.now() + 60_000).toISOString()
    mocks.report
      .mockResolvedValueOnce(response())
      .mockResolvedValue(response({ nextManualRefreshAt }))
    mocks.refresh.mockResolvedValue({
      status: 'cooldown',
      remainingEntries: 0,
      nextManualRefreshAt,
    })
    renderReport()
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh insights' }))

    expect(await screen.findByText(/Refresh becomes available after/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh available tomorrow' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('disables refresh from the report cooldown even before the button is clicked', async () => {
    mocks.report.mockResolvedValue(
      response({ nextManualRefreshAt: new Date(Date.now() + 60_000).toISOString() }),
    )

    renderReport()

    expect(
      await screen.findByRole('button', { name: 'Refresh available tomorrow' }),
    ).toHaveProperty('disabled', true)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('confirms server eligibility and re-enables refresh after cooldown expiry without a reload', async () => {
    const nextManualRefreshAt = new Date(Date.now() + 75).toISOString()
    mocks.report.mockResolvedValue(response({ nextManualRefreshAt }))

    renderReport()

    expect(
      await screen.findByRole('button', { name: 'Refresh available tomorrow' }),
    ).toHaveProperty('disabled', true)
    await waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Refresh insights' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('keeps refresh disabled when generation is still in progress after cooldown expiry', async () => {
    mocks.report.mockResolvedValue(
      response({
        status: 'updating',
        nextManualRefreshAt: new Date(Date.now() - 1).toISOString(),
      }),
    )

    renderReport()

    expect(await screen.findByRole('button', { name: 'Updating insights...' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows the remaining analyzed entries instead of a generic error', async () => {
    mocks.report.mockResolvedValue(
      response({ status: 'notEnoughEntries', report: null, remainingEntries: 2 }),
    )

    renderReport()

    expect(await screen.findAllByText(/Analyze 2 more entries/i)).toHaveLength(2)
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull()
  })

  it('stops polling when the report is ready or the timeout is reached', () => {
    expect(nextInsightReportPollInterval('ready', 0, 1)).toBe(false)
    expect(nextInsightReportPollInterval('updating', 0, INSIGHT_REPORT_POLL_TIMEOUT_MS)).toBe(false)
    expect(nextInsightReportPollInterval('updating', 0, INSIGHT_REPORT_POLL_TIMEOUT_MS - 1)).toBe(
      4_000,
    )
  })

  it('shows a query failure without replacing a saved report with a generic empty state', async () => {
    mocks.report.mockRejectedValue(new Error('network unavailable'))

    renderReport()

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()
  })
})
