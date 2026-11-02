/** Small data-display primitives: stat card, trend badge. Charts live in components/insights. */
import type { ReactNode } from 'react'
import { ArrowUpRight, Minus, ArrowDownRight } from 'lucide-react'
import { cn } from 'cn'

import { Card } from './card'

export function StatCard({
  value,
  label,
  icon,
  className,
}: {
  value: ReactNode
  label: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <span className="font-serif text-[32px] leading-none font-extrabold text-neutral-900">
          {value}
        </span>
        {icon}
      </div>
      <span className="text-[13px] text-neutral-600">{label}</span>
    </Card>
  )
}

export type Trend = 'rising' | 'steady' | 'easing'

export function TrendBadge({ trend }: { trend: Trend }) {
  const styles = {
    rising: { cls: 'bg-cloud-100 text-cloud-700', Icon: ArrowUpRight, label: 'rising' },
    steady: { cls: 'bg-neutral-100 text-neutral-600', Icon: Minus, label: 'steady' },
    easing: { cls: 'bg-sage-100 text-sage-700', Icon: ArrowDownRight, label: 'easing' },
  }[trend]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap',
        styles.cls,
      )}
    >
      <styles.Icon className="size-3" strokeWidth={2.6} />
      {styles.label}
    </span>
  )
}
