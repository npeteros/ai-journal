'use client'

import { skipToken, useQuery } from '@tanstack/react-query'

import { useBrowserTimeZone } from '@/src/lib/browser-time-zone'
import { cssVar, moodColor, moodLabel } from '@/src/lib/design-tokens/colors'
import { useTRPC } from '@/src/server/trpc/client'

const dayInitial = new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' })
const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })

type Day = { entryDate: string | null; mood: keyof typeof moodColor | null }

/** Shown until the week loads (the browser's time zone isn't known during SSR). */
const LOADING_WEEK: Day[] = Array.from({ length: 7 }, () => ({ entryDate: null, mood: null }))

/**
 * The last 7 days as mood dots, oldest first, today last. A day's mood is its lowest-scoring
 * entry's mood (see `computeWeekMoods`); days without an analyzed entry are empty rings.
 * Sits on the always-dark today band.
 */
export function WeekMoodStrip() {
  const trpc = useTRPC()
  const timeZone = useBrowserTimeZone()
  const { data } = useQuery(
    trpc.v1.entry.weekMoods.queryOptions(timeZone === undefined ? skipToken : { timeZone }),
  )
  const week: Day[] = data ?? LOADING_WEEK

  return (
    <ol
      className="flex justify-between gap-4 sm:justify-start"
      aria-label="Mood each day this week"
      aria-busy={data === undefined}
    >
      {week.map((d, i) => {
        const today = i === week.length - 1
        const date = d.entryDate ? new Date(`${d.entryDate}T00:00:00Z`) : null
        const color = d.mood ? cssVar(moodColor[d.mood]) : undefined

        return (
          <li key={i} className="flex flex-col items-center gap-2">
            <span
              className={
                d.mood
                  ? 'relative size-3 rounded-full'
                  : 'relative size-3 rounded-full border-[1.5px] border-white/25'
              }
              style={color ? { background: color } : undefined}
              title={d.mood ? moodLabel[d.mood] : undefined}
            >
              {today && color && (
                <span
                  className="lv-ripple absolute -inset-1.5 rounded-full border-[1.5px]"
                  style={{ borderColor: color }}
                />
              )}
              <span className="sr-only">
                {date ? `${dayName.format(date)}: ` : ''}
                {d.mood ? moodLabel[d.mood] : 'no analyzed entry'}
              </span>
            </span>
            <span
              aria-hidden
              className={
                today
                  ? 'text-[10px] leading-none font-extrabold text-[oklch(90%_0.08_60)]'
                  : 'text-[10px] leading-none font-semibold text-[oklch(75%_0.02_260)]'
              }
            >
              {date ? dayInitial.format(date) : ' '}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
