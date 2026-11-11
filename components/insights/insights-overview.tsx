'use client'

import { useQuery } from '@tanstack/react-query'

import { BarList } from '@/components/insights/bar-list'
import { LineChart } from '@/components/insights/line-chart'
import { useBrowserTimeZone } from '@/components/insights/use-browser-time-zone'
import { getApiErrorMessage } from '@/components/journal/api-error'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Card, CardHeading } from '@/components/ui/card'
import { MoodDot } from '@/components/ui/chip'
import { StatCard } from '@/components/ui/data'
import { moodLabel } from '@/src/lib/design-tokens/colors'
import { INSIGHTS_MIN_ANALYZED_ENTRIES } from '@/src/server/api/routers/v1/insights/schema'
import { useTRPC } from '@/src/server/trpc/client'

const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
const weekdayLongFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })

/** `date` is a `YYYY-MM-DD` key already resolved in the user's time zone, so format it as UTC. */
const toDate = (date: string) => new Date(`${date}T00:00:00.000Z`)

function weekChartLabel(week: { date: string; value: number | null }[]) {
  const scored = week.filter((d): d is { date: string; value: number } => d.value !== null)
  if (scored.length === 0) return 'Mood this week: no analyzed entries yet.'
  const lowest = scored.reduce((a, b) => (b.value < a.value ? b : a))
  const highest = scored.reduce((a, b) => (b.value > a.value ? b : a))
  return `Mood this week: lowest on ${weekdayLongFormat.format(toDate(lowest.date))}, highest on ${weekdayLongFormat.format(toDate(highest.date))}.`
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading insights" className="flex flex-col gap-5">
      <div className="grid animate-pulse gap-5 lg:grid-cols-[2fr_1fr]">
        <Card className="flex flex-col gap-3 lg:p-6">
          <div className="h-3 w-28 rounded bg-neutral-200" />
          <div className="h-[180px] w-full rounded bg-neutral-100" />
        </Card>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-1">
          <Card className="h-full min-h-[92px]">
            <div className="h-8 w-12 rounded bg-neutral-200" />
          </Card>
          <Card className="h-full min-h-[92px]">
            <div className="h-8 w-12 rounded bg-neutral-200" />
          </Card>
        </div>
      </div>
      <div className="grid animate-pulse gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="flex h-full flex-col gap-4">
            <div className="h-3 w-24 rounded bg-neutral-200" />
            <div className="h-3 w-full rounded bg-neutral-100" />
            <div className="h-3 w-5/6 rounded bg-neutral-100" />
            <div className="h-3 w-2/3 rounded bg-neutral-100" />
          </Card>
        ))}
      </div>
    </div>
  )
}

/** The Insights overview, read from `v1.insights.overview` in the browser's time zone. */
export function InsightsOverview() {
  const trpc = useTRPC()
  const timeZone = useBrowserTimeZone()

  const query = useQuery({
    ...trpc.v1.insights.overview.queryOptions({ timeZone: timeZone ?? 'UTC' }),
    enabled: timeZone !== undefined,
  })

  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[14px] text-neutral-600">{getApiErrorMessage(query.error)}</p>
        <Button variant="soft" size="md" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!query.data) return <OverviewSkeleton />

  const { moodThisWeek, moodMix, topThemes, entriesThisMonth, analyzedCount } = query.data

  if (analyzedCount < INSIGHTS_MIN_ANALYZED_ENTRIES) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-[15px] font-semibold text-neutral-900">
          Write a few more entries to see your insights
        </p>
        <p className="text-[13px] text-neutral-600">
          Charts show up once {INSIGHTS_MIN_ANALYZED_ENTRIES} entries have been analyzed.
        </p>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Rise className="relative">
          <JadenPerch width={PLACEMENTS.insights.size} position={{ right: 24 }}>
            <JadenFor placement="insights" />
          </JadenPerch>
          <Card className="flex flex-col gap-3 lg:p-6">
            <CardHeading>Mood, this week</CardHeading>
            <LineChart
              data={moodThisWeek.map((d) => ({
                label: weekdayFormat.format(toDate(d.date)),
                value: d.value,
              }))}
              points
              label={weekChartLabel(moodThisWeek)}
            />
          </Card>
        </Rise>

        <div className="grid grid-cols-2 gap-5 lg:grid-cols-1">
          <Rise i={1} className="h-full">
            <StatCard
              className="h-full justify-center"
              value={entriesThisMonth}
              label="entries this month"
            />
          </Rise>
          <Rise i={2} className="h-full">
            <StatCard
              className="h-full justify-center"
              value={analyzedCount}
              label="entries analyzed"
            />
          </Rise>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Rise i={3}>
          <Card className="flex h-full flex-col gap-4">
            <CardHeading>Mood mix</CardHeading>
            <ul className="flex flex-wrap gap-2">
              {moodMix.map((m) => (
                <li
                  key={m.mood}
                  className="flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-2"
                >
                  <MoodDot mood={m.mood} size={8} />
                  <span className="text-[13px] font-semibold text-neutral-600">
                    {moodLabel[m.mood]} · {m.count}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Rise>
        <Rise i={4}>
          <Card className="flex h-full flex-col gap-4">
            <CardHeading>Top themes</CardHeading>
            {topThemes.length === 0 ? (
              <p className="text-[13px] text-neutral-600">No themes yet.</p>
            ) : (
              <BarList
                data={topThemes.map((t) => ({ label: t.label, value: t.pct }))}
                seriesLabel="Share of entries"
                label={`Top themes: ${topThemes.map((t) => `${t.label} ${t.pct}%`).join(', ')}.`}
              />
            )}
          </Card>
        </Rise>
      </div>
    </>
  )
}
