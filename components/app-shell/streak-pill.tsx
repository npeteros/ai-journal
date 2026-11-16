'use client'

import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'

import { FlameIcon } from '@/components/brand/icons'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { useTRPC } from '@/src/server/trpc/client'

/** Current streak, hydrated from the layout's prefetch. Decorative, so a failed query shows 0. */
export function StreakPill({ className }: { className?: string }) {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.v1.entry.stats.queryOptions({ timeZone: APP_TIME_ZONE }))
  const days = data?.currentStreak ?? 0

  return (
    <span
      className={cn(
        'lv-ember inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2',
        className,
      )}
    >
      <FlameIcon className="lv-flame text-amber-500" />
      <span className="text-[13px] leading-none font-bold text-amber-700">{days} day streak</span>
    </span>
  )
}
