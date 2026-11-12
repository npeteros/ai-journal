'use client'

import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Card, CardHeading } from '@/components/ui/card'
import { useTRPC } from '@/src/server/trpc/client'

type RefreshStatus =
  | 'generated'
  | 'insufficient_entries'
  | 'insufficient_evidence'
  | 'cooldown'
  | 'refresh_in_progress'
  | 'rate_limited'
  | 'timed_out'
  | 'failed'

const refreshMessage: Record<RefreshStatus, string> = {
  generated: 'Your latest insights are ready.',
  insufficient_entries: 'Write and analyze at least five recent entries to generate a report.',
  insufficient_evidence: 'There is not enough consistent evidence for a report yet.',
  cooldown: 'Your report is already up to date. Check back tomorrow for a refresh.',
  refresh_in_progress: 'A report is already being prepared.',
  rate_limited: 'You have reached the current AI limit. Please try again later.',
  timed_out: 'The report took too long to prepare. Please try again.',
  failed: 'The report could not be refreshed. Please try again.',
}

function useInsightReport() {
  const trpc = useTRPC()
  return useQuery(trpc.v1.insights.report.queryOptions())
}

function RefreshReportButton({ onRefreshed }: { onRefreshed: () => void }) {
  const trpc = useTRPC()
  const refresh = useMutation({
    ...trpc.v1.insights.refresh.mutationOptions(),
    onSuccess: () => onRefreshed(),
  })
  const status = refresh.data?.status as RefreshStatus | undefined

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="soft"
        size="md"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate()}
      >
        {refresh.isPending ? 'Refreshing insights...' : 'Refresh insights'}
      </Button>
      {status && <p className="text-[13px] text-neutral-600">{refreshMessage[status]}</p>}
      {refresh.isError && (
        <p role="alert" className="text-[13px] text-red-700">
          {getApiErrorMessage(refresh.error)}
        </p>
      )}
    </div>
  )
}

function ReportUnavailable({ query }: { query: ReturnType<typeof useInsightReport> }) {
  if (query.isError) {
    return (
      <p role="alert" className="text-[13px] text-red-700">
        {getApiErrorMessage(query.error)}
      </p>
    )
  }
  return (
    <p className="text-[13px] leading-relaxed text-neutral-600">
      {query.isPending
        ? 'Loading your latest report...'
        : 'Your first report will appear once there are enough recent analyzed entries.'}
    </p>
  )
}

export function GrowthSuggestions() {
  const query = useInsightReport()
  const suggestions = query.data?.growthSuggestions ?? []

  return (
    <div className="flex flex-col gap-5">
      {!query.data ? (
        <Card className="flex flex-col gap-4">
          <CardHeading>Suggestions will appear here</CardHeading>
          <ReportUnavailable query={query} />
          <RefreshReportButton onRefreshed={() => query.refetch()} />
        </Card>
      ) : suggestions.length === 0 ? (
        <Card className="flex flex-col gap-4">
          <CardHeading>No suggestions yet</CardHeading>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Your latest entries did not show a strong enough pattern for a useful suggestion.
          </p>
          <RefreshReportButton onRefreshed={() => query.refetch()} />
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
                  <Card className="flex h-full flex-col gap-2.5">
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
          <RefreshReportButton onRefreshed={() => query.refetch()} />
        </>
      )}
    </div>
  )
}

export function RecurringThemes() {
  const query = useInsightReport()
  const themes = query.data?.recurringThemes ?? []

  return (
    <Card className="flex flex-col gap-1 lg:p-6">
      <CardHeading className="mb-2">Recurring themes</CardHeading>
      {!query.data ? (
        <ReportUnavailable query={query} />
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
  const query = useInsightReport()
  const suggestion = query.data?.growthSuggestions[0]

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
  const query = useInsightReport()
  const caption = query.data?.trendCaption
  if (!caption) return null

  return <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-neutral-600">{caption}</p>
}
