'use client'

import { useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { EASE_OUT, Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { cssVar, moodColor } from '@/src/lib/design-tokens/colors'
import { storyLine, type StoryMood } from '@/src/server/api/routers/v1/insights/schema'
import { useTRPC } from '@/src/server/trpc/client'

const STORY_INPUT = { timeZone: APP_TIME_ZONE }

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
const monthYearFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function monthLabel(month: string, currentYear: number) {
  const date = new Date(`${month}-01T00:00:00Z`)
  return date.getUTCFullYear() === currentYear
    ? monthFormat.format(date)
    : monthYearFormat.format(date)
}

function summaryLine(entryCount: number, mood: StoryMood | null, summary: string | null) {
  const computed = storyLine(entryCount, mood)
  return summary ? `${computed}, ${summary}.` : `${computed}.`
}

function StorySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your story"
      className="flex animate-pulse flex-col gap-5 pl-8"
    >
      {[0, 1, 2].map((i) => (
        <Card key={i} className="flex flex-col gap-3">
          <div className="h-5 w-28 rounded bg-neutral-200" />
          <div className="h-3 w-3/4 rounded bg-neutral-100" />
          <div className="h-3 w-5/6 rounded bg-neutral-100" />
        </Card>
      ))}
    </div>
  )
}

export function StoryView() {
  const sentinel = useRef<HTMLLIElement>(null)

  const trpc = useTRPC()
  const query = useInfiniteQuery({
    ...trpc.v1.insights.story.infiniteQueryOptions(STORY_INPUT, {
      getNextPageParam: (page) => page.nextCursor,
    }),
  })
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasNextPage || isFetchNextPageError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  const header = (
    <p className="font-serif text-[18px] text-neutral-600 italic">
      Your story, told a month at a time
    </p>
  )

  if (!query.data) {
    return (
      <>
        {header}
        {query.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[14px] text-neutral-600">{getApiErrorMessage(query.error)}</p>
            <Button variant="soft" size="md" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <StorySkeleton />
        )}
      </>
    )
  }

  const months = query.data.pages.flatMap((page) => page.months)
  const highlight = query.data.pages[0]?.highlight ?? null
  const currentYear = Number(query.data.pages[0]?.currentMonth.slice(0, 4))

  if (!highlight) {
    return (
      <>
        {header}
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-[15px] font-semibold text-neutral-900">Your story starts soon</p>
          <p className="text-[13px] text-neutral-600">
            Once you&apos;ve journaled through a full month, its recap shows up here.
          </p>
        </Card>
      </>
    )
  }

  return (
    <>
      {header}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ol className="relative flex flex-col gap-5 pl-8">
          <motion.span
            aria-hidden
            className="absolute top-2 bottom-2 left-[9px] w-0.5 origin-top rounded-full bg-neutral-200"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.2, ease: EASE_OUT }}
          />
          {months.map((m, i) => (
            <li key={m.month} className="relative">
              <motion.span
                aria-hidden
                className="absolute top-6 -left-8 size-5 rounded-full border-4 border-bg"
                style={{ background: cssVar(m.mood ? moodColor[m.mood] : 'neutral-300') }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 18,
                  delay: 0.3 + Math.min(i, 5) * 0.15,
                }}
              />
              <Rise i={Math.min(i, 5) + 1}>
                <Card className="flex flex-col gap-2">
                  <h2 className="font-serif text-[20px] font-semibold text-neutral-900">
                    {monthLabel(m.month, currentYear)}
                  </h2>
                  <p className="text-[13px] leading-normal text-neutral-600">
                    {summaryLine(m.entryCount, m.mood, m.summary)}
                  </p>
                  <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 font-serif text-[15px] leading-relaxed text-neutral-900 italic">
                    &ldquo;{m.quote.text}&rdquo;
                  </blockquote>
                </Card>
              </Rise>
            </li>
          ))}
          {hasNextPage && !isFetchNextPageError && (
            <li ref={sentinel} className="h-px">
              {isFetchingNextPage && <span className="sr-only">Loading older months</span>}
            </li>
          )}
          {isFetchNextPageError && (
            <li role="alert" className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-[13px] text-neutral-600">{getApiErrorMessage(query.error)}</p>
              <Button variant="soft" size="md" onClick={() => fetchNextPage()}>
                Try again
              </Button>
            </li>
          )}
        </ol>

        <Rise i={2} className="lg:sticky lg:top-10 lg:self-start">
          <Card className="flex flex-col gap-4 lg:p-7">
            <span className="text-[11px] font-bold tracking-[0.08em] text-amber-700 uppercase">
              {monthLabel(highlight.date.slice(0, 7), currentYear)}, in your words
            </span>
            <p className="font-serif text-[22px] leading-[1.45] text-neutral-900 italic">
              &ldquo;{highlight.text}&rdquo;
            </p>
            <span className="text-[12px] font-semibold text-neutral-400">
              {highlight.title} · {dayFormat.format(new Date(`${highlight.date}T00:00:00Z`))}
            </span>
          </Card>
        </Rise>
      </div>
    </>
  )
}
