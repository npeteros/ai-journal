'use client'

import Link from 'next/link'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Card, CardHeading } from '@/components/ui/card'
import { useTRPC } from '@/src/server/trpc/client'

const INSIGHT_REPORT_POLL_INTERVAL_MS = 4_000
export const INSIGHT_REPORT_POLL_TIMEOUT_MS = 2 * 60 * 1_000

type ReportStatus = 'ready' | 'updating' | 'notEnoughEntries'

type ClientInsightReport = {
  recurringThemes: {
    title: string
    mentions: number
    trend: 'rising' | 'steady' | 'falling'
    entryIds: string[]
  }[]
  growthSuggestions: { title: string; body: string; short: string; entryIds: string[] }[]
  trendCaption: string | null
}

type InsightReportData = {
  status: ReportStatus
  report: ClientInsightReport | null
  remainingEntries: number
  nextManualRefreshAt: string | null
}

type InsightReportQuery = {
  data: InsightReportData | undefined
  error: unknown
  isError: boolean
  isPending: boolean
  refetch: () => Promise<{ data: InsightReportData | undefined; isError: boolean }>
}

type InsightReportContextValue = {
  query: InsightReportQuery
  isPolling: boolean
  isManualRefreshAvailable: boolean
  wasUpdated: boolean
  recordManualRefreshCooldown: (nextManualRefreshAt: string | null) => void
  restartPolling: () => void
}

const InsightReportContext = createContext<InsightReportContextValue | null>(null)

export function nextInsightReportPollInterval(
  status: ReportStatus | undefined,
  pollingStartedAt: number | null,
  now = Date.now(),
): number | false {
  if (status !== 'updating' || pollingStartedAt === null) return false
  return now - pollingStartedAt < INSIGHT_REPORT_POLL_TIMEOUT_MS
    ? INSIGHT_REPORT_POLL_INTERVAL_MS
    : false
}

function formatRefreshTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function useInsightReportQuery() {
  const trpc = useTRPC()
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [manualRefreshCooldownAt, setManualRefreshCooldownAt] = useState<string | null>(null)
  const [isConfirmingManualRefreshEligibility, setIsConfirmingManualRefreshEligibility] =
    useState(false)
  const previousStatus = useRef<ReportStatus | undefined>(undefined)
  const [wasUpdated, setWasUpdated] = useState(false)

  const query = useQuery({
    ...trpc.v1.insights.report.queryOptions(),
    placeholderData: keepPreviousData,
    refetchInterval: (currentQuery) => {
      const status = currentQuery.state.data?.status
      return nextInsightReportPollInterval(status, pollingStartedAt)
    },
  })

  const status = query.data?.status
  const { refetch } = query
  const isPolling = nextInsightReportPollInterval(status, pollingStartedAt) !== false
  const nextManualRefreshAt = manualRefreshCooldownAt ?? query.data?.nextManualRefreshAt
  const manualRefreshAtMs = nextManualRefreshAt ? new Date(nextManualRefreshAt).getTime() : null
  const isManualRefreshAvailable =
    !isConfirmingManualRefreshEligibility &&
    (manualRefreshAtMs === null || manualRefreshAtMs <= clock)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (status === 'updating') {
        setPollingStartedAt((current) => current ?? Date.now())
        setWasUpdated(false)
      } else {
        if (previousStatus.current === 'updating' && status === 'ready') setWasUpdated(true)
        setPollingStartedAt(null)
      }
      previousStatus.current = status
    })
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (manualRefreshAtMs === null || manualRefreshAtMs <= Date.now()) return
    const timer = window.setTimeout(() => {
      setIsConfirmingManualRefreshEligibility(true)
      void refetch()
        .then((result) => {
          setClock(Date.now())
          if (!result.isError) recordManualRefreshCooldown(result.data?.nextManualRefreshAt ?? null)
          setIsConfirmingManualRefreshEligibility(result.isError)
        })
        .catch(() => {
          setClock(Date.now())
          setIsConfirmingManualRefreshEligibility(true)
        })
    }, manualRefreshAtMs - Date.now())
    return () => window.clearTimeout(timer)
  }, [manualRefreshAtMs, refetch])

  function restartPolling() {
    setPollingStartedAt(Date.now())
    setWasUpdated(false)
  }

  function recordManualRefreshCooldown(nextManualRefreshAt: string | null) {
    setManualRefreshCooldownAt(nextManualRefreshAt)
    setIsConfirmingManualRefreshEligibility(false)
  }

  return {
    query,
    isPolling,
    isManualRefreshAvailable,
    wasUpdated,
    recordManualRefreshCooldown,
    restartPolling,
  }
}

export function InsightReportProvider({ children }: { children: ReactNode }) {
  const value = useInsightReportQuery()
  return <InsightReportContext.Provider value={value}>{children}</InsightReportContext.Provider>
}

function useInsightReport() {
  const context = useContext(InsightReportContext)
  if (!context) throw new Error('Insight report components require InsightReportProvider')
  return context
}

export function InsightReportStatus() {
  const { isPolling, query, wasUpdated } = useInsightReport()
  const { status, remainingEntries } = query.data ?? {}

  if (status === 'updating') {
    return (
      <output className="text-[13px] text-cloud-700">
        {isPolling
          ? 'Updating your insights...'
          : 'Your insights are still updating. Check back shortly.'}
      </output>
    )
  }

  if (status === 'notEnoughEntries') {
    return (
      <output className="text-[13px] text-neutral-600">
        Analyze {remainingEntries} more {remainingEntries === 1 ? 'entry' : 'entries'} to prepare
        your first report.
      </output>
    )
  }

  if (wasUpdated) {
    return <output className="text-[13px] text-sage-700">Your insights were updated.</output>
  }

  return null
}

function RefreshReportButton() {
  const trpc = useTRPC()
  const { isManualRefreshAvailable, query, recordManualRefreshCooldown, restartPolling } =
    useInsightReport()
  const refresh = useMutation({
    ...trpc.v1.insights.refresh.mutationOptions(),
    onSuccess: (result) => {
      recordManualRefreshCooldown(result.nextManualRefreshAt)
      if (result.status === 'refresh_in_progress') restartPolling()
      void query.refetch().then((report) => {
        if (!report.isError) recordManualRefreshCooldown(report.data?.nextManualRefreshAt ?? null)
      })
    },
  })
  const nextManualRefreshAt = query.data?.nextManualRefreshAt ?? refresh.data?.nextManualRefreshAt
  const cooldown = !isManualRefreshAvailable
  const updating = query.data?.status === 'updating'
  const disabled = refresh.isPending || updating || cooldown

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="soft"
        size="md"
        disabled={disabled}
        onClick={() => refresh.mutate()}
      >
        {cooldown
          ? 'Refresh available tomorrow'
          : updating
            ? 'Updating insights...'
            : 'Refresh insights'}
      </Button>
      {cooldown && (
        <output className="text-[13px] text-neutral-600">
          Refresh becomes available{' '}
          {nextManualRefreshAt ? `after ${formatRefreshTime(nextManualRefreshAt)}.` : 'tomorrow.'}
        </output>
      )}
      {refresh.data?.status === 'insufficient_entries' && (
        <output className="text-[13px] text-neutral-600">
          Analyze {refresh.data.remainingEntries} more{' '}
          {refresh.data.remainingEntries === 1 ? 'entry' : 'entries'} before refreshing.
        </output>
      )}
      {refresh.isError && (
        <p role="alert" className="text-[13px] text-red-700">
          {getApiErrorMessage(refresh.error)}
        </p>
      )}
    </div>
  )
}

function ReportUnavailable() {
  const { query } = useInsightReport()
  const remainingEntries = query.data?.remainingEntries ?? 0

  if (query.isError) {
    return (
      <p role="alert" className="text-[13px] text-red-700">
        {getApiErrorMessage(query.error)}
      </p>
    )
  }

  if (query.isPending) {
    return <div aria-busy="true" className="h-[72px] animate-pulse rounded bg-neutral-100" />
  }

  if (query.data?.status === 'notEnoughEntries') {
    return (
      <p className="text-[13px] leading-relaxed text-neutral-600">
        Analyze {remainingEntries} more {remainingEntries === 1 ? 'entry' : 'entries'} to prepare
        your first report.
      </p>
    )
  }

  return (
    <p className="text-[13px] leading-relaxed text-neutral-600">
      Your first report is being prepared. Your earlier insights will stay visible while it updates.
    </p>
  )
}

export function GrowthSuggestions() {
  const { query } = useInsightReport()
  const report = query.data?.report
  const suggestions = report?.growthSuggestions ?? []

  return (
    <div className="flex flex-col gap-5">
      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Loading growth suggestions"
          className="grid animate-pulse gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map((index) => (
            <Card key={index} className="h-[188px] bg-neutral-100" />
          ))}
        </div>
      ) : !report ? (
        <Card className="flex min-h-[188px] flex-col gap-4">
          <CardHeading>Suggestions will appear here</CardHeading>
          <ReportUnavailable />
          <RefreshReportButton />
        </Card>
      ) : suggestions.length === 0 ? (
        <Card className="flex min-h-[188px] flex-col gap-4">
          <CardHeading>No suggestions yet</CardHeading>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Your latest entries did not show a strong enough pattern for a useful suggestion.
          </p>
          <RefreshReportButton />
        </Card>
      ) : (
        <>
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.title}>
                <Rise i={index} className="relative h-full">
                  {index === 0 && (
                    <JadenPerch width={PLACEMENTS.growth.size} position={{ right: 12 }}>
                      <JadenFor placement="growth" />
                    </JadenPerch>
                  )}
                  <Card className="flex min-h-[188px] flex-col gap-2.5 lg:p-6">
                    <h2 className="font-serif text-[18px] leading-snug font-semibold text-neutral-900">
                      {suggestion.title}
                    </h2>
                    <p className="flex-1 text-[13px] leading-[1.6] text-neutral-600">
                      {suggestion.body}
                    </p>
                    <Link
                      href="/journal/new"
                      className="mt-1 text-[13px] font-semibold text-cloud-700 hover:underline"
                    >
                      Write about this
                    </Link>
                  </Card>
                </Rise>
              </li>
            ))}
          </ul>
          <RefreshReportButton />
        </>
      )}
    </div>
  )
}

export function RecurringThemes() {
  const { query } = useInsightReport()
  const report = query.data?.report
  const themes = report?.recurringThemes ?? []

  return (
    <Card className="flex min-h-[188px] flex-col gap-1 lg:p-6">
      <CardHeading className="mb-2">Recurring themes</CardHeading>
      {query.isPending || !report ? (
        <ReportUnavailable />
      ) : themes.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-neutral-600">
          No recurring themes were strong enough to show in the latest report.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {themes.map((theme) => (
            <li key={theme.title} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold text-neutral-900">{theme.title}</span>
                <span className="text-[12px] text-neutral-400">
                  Mentioned in {theme.mentions} {theme.mentions === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                {theme.trend}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function ForYouSuggestion() {
  const { query } = useInsightReport()
  const suggestion = query.data?.report?.growthSuggestions[0]

  if (!suggestion) return null

  return (
    <Card className="flex flex-col gap-2 bg-[linear-gradient(160deg,var(--sage-100),var(--cloud-100))] lg:p-6">
      <span className="text-[11px] font-bold tracking-[0.08em] text-sage-700 uppercase">
        For you
      </span>
      <p className="font-serif text-[18px] leading-snug font-semibold text-neutral-900">
        {suggestion.title}
      </p>
      <p className="text-[13px] leading-normal text-neutral-600">{suggestion.short}</p>
      <Link
        href="/insights/growth"
        className="mt-1 text-[13px] font-semibold text-cloud-700 hover:underline"
      >
        View suggestions
      </Link>
    </Card>
  )
}

/** A report-generated caption, deliberately separate from the factual mood chart summary. */
export function InsightTrendCaption() {
  const { query } = useInsightReport()
  const caption = query.data?.report?.trendCaption
  if (!caption) return null

  return <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-neutral-600">{caption}</p>
}
