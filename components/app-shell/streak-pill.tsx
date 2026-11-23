'use client'

import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'

import { FlameIcon } from '@/components/brand/icons'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { useTRPC } from '@/src/server/trpc/client'
import { useHydrated } from '@/src/lib/use-hydrated'

/**
 * Current streak, streamed from the layout's prefetch. While it loads, the label keeps its space
 * but stays hidden so it never flashes "0". Decorative, so a failed query shows 0.
 */
export function StreakPill({
  className,
  'data-tour': dataTour,
}: {
  className?: string
  'data-tour'?: string
}) {
  const trpc = useTRPC()
  const { data, isPending } = useQuery(
    trpc.v1.entry.stats.queryOptions({ timeZone: APP_TIME_ZONE }),
  )
  // Wait for hydration: the streamed query may resolve between the server render and hydration,
  // and a mismatched `invisible` class from the server would never be removed.
  const loading = !useHydrated() || isPending
  const days = data?.currentStreak ?? 0

  return (
    <span
      data-tour={dataTour}
      className={cn(
        'lv-ember inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2',
        className,
      )}
    >
      <FlameIcon className="lv-flame text-amber-500" />
      <span
        aria-busy={loading}
        className={cn('text-[13px] leading-none font-bold text-amber-700', loading && 'invisible')}
      >
        {days} day streak
      </span>
    </span>
  )
}
