import { cn } from 'cn'

import { FlameIcon } from '@/components/brand/icons'

export function StreakPill({ days, className }: { days: number; className?: string }) {
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
