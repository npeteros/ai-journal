'use client'

import { useQuery } from '@tanstack/react-query'

import { LineChart } from '@/components/insights/line-chart'
import { useBrowserTimeZone } from '@/components/insights/use-browser-time-zone'
import { getApiErrorMessage } from '@/components/journal/api-error'
import { Button } from '@/components/ui/button'
import { Card, CardHeading } from '@/components/ui/card'
import { useTRPC } from '@/src/server/trpc/client'

const CHART_HEIGHT = 160
/** Changes smaller than this (on the 0–100 scale) read as "steady". */
const STEADY_THRESHOLD = 5

const monthShortFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const monthLongFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })

/** `month` is a `YYYY-MM` key already resolved in the user's time zone, so format it as UTC. */
const toDate = (month: string) => new Date(`${month}-01T00:00:00.000Z`)

/** A factual summary of the trend, used as both the visible caption and the chart's label. */
function trendCaption(trend: { month: string; value: number | null }[]) {
  const scored = trend.filter((p): p is { month: string; value: number } => p.value !== null)
  if (scored.length === 0) return 'No analyzed entries in the last 6 months yet.'

  const last = scored[scored.length - 1]
  const lastMonth = monthLongFormat.format(toDate(last.month))
  if (scored.length === 1) return `Your mood averaged ${last.value}/100 in ${lastMonth}.`

  const first = scored[0]
  const firstMonth = monthLongFormat.format(toDate(first.month))
  const change = last.value - first.value
  if (Math.abs(change) < STEADY_THRESHOLD) {
    return `Your mood has held steady since ${firstMonth}, averaging ${last.value}/100 in ${lastMonth}.`
  }
  return `Your average mood has ${change > 0 ? 'risen' : 'fallen'} from ${first.value}/100 in ${firstMonth} to ${last.value}/100 in ${lastMonth}.`
}

/** Six-month emotional trend, read from `v1.insights.overview` in the browser's time zone. */
export function EmotionalTrendCard() {
  const trpc = useTRPC()
  const timeZone = useBrowserTimeZone()

  const query = useQuery({
    ...trpc.v1.insights.overview.queryOptions({ timeZone: timeZone ?? 'UTC' }),
    enabled: timeZone !== undefined,
  })

  let body
  if (query.data) {
    const { emotionalTrend } = query.data
    const caption = trendCaption(emotionalTrend)
    body = (
      <>
        <LineChart
          data={emotionalTrend.map((p) => ({
            label: monthShortFormat.format(toDate(p.month)),
            value: p.value,
          }))}
          tone="cloud-500"
          height={CHART_HEIGHT}
          label={caption}
        />
        <p className="text-[13px] leading-normal text-neutral-600">{caption}</p>
      </>
    )
  } else if (query.isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-[13px] text-neutral-600">{getApiErrorMessage(query.error)}</p>
        <Button variant="soft" size="md" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  } else {
    body = (
      <div aria-busy="true" aria-label="Loading emotional trend" className="animate-pulse">
        <div className="w-full rounded bg-neutral-100" style={{ height: CHART_HEIGHT }} />
        <div className="mt-3 h-3 w-5/6 rounded bg-neutral-100" />
      </div>
    )
  }

  return (
    <Card className="flex flex-col gap-3 lg:p-6">
      <CardHeading>Emotional trend, last 6 months</CardHeading>
      {body}
    </Card>
  )
}
