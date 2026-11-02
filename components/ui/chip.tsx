import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

import { cssVar, moodColor, type Mood } from '@/src/lib/design-tokens/colors'

const chipVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        /** Small neutral tag on entry cards */
        tag: 'bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600',
        /** Filter chip, inactive */
        filter:
          'border border-neutral-200 bg-surface px-[18px] py-[9px] text-[13px] font-medium text-neutral-600 hover:border-neutral-300',
        /** Filter chip, active */
        'filter-active': 'bg-neutral-900 px-[18px] py-[9px] text-[13px] font-semibold text-surface',
        /** Outline "Add tag" */
        add: 'border border-dashed border-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-100',
        /** AI-suggested tag */
        suggested:
          'border border-dashed border-sage-500 bg-sage-100 px-3 py-1.5 text-[12px] font-semibold text-sage-700',
        /** Badge pill with icon */
        sage: 'bg-sage-100 px-3 py-1.5 text-[12px] font-semibold text-sage-700',
        cloud: 'bg-cloud-100 px-3 py-1.5 text-[12px] font-semibold text-cloud-700',
        amber: 'bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700',
        neutral: 'bg-neutral-100 px-3 py-1.5 text-[12px] font-semibold text-neutral-600',
      },
    },
    defaultVariants: { variant: 'tag' },
  },
)

type ChipProps = ComponentProps<'span'> & VariantProps<typeof chipVariants>

export function Chip({ className, variant, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ variant }), className)} {...props} />
}

export { chipVariants }

/** A coloured mood dot. */
export function MoodDot({
  mood,
  size = 10,
  className,
}: {
  mood: Mood
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, background: cssVar(moodColor[mood]) }}
    />
  )
}
