import type { ComponentProps } from 'react'
import { cn } from 'cn'

import { moodSpineClass, type Mood } from '@/src/lib/design-tokens/colors'

type CardProps = ComponentProps<'div'> & {
  /** Lift on hover (interactive cards). */
  hover?: boolean
  /** Coloured mood spine on the left edge (entry cards). */
  mood?: Mood
}

/** Frosted paper card (lv-card): radius 16, soft shadow, lets the page aura breathe through. */
export function Card({ className, hover = false, mood, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'lv-card rounded-2xl p-5 lg:p-[22px]',
        hover && 'lv-card-hover',
        mood && cn('lv-mood', moodSpineClass[mood]),
        className,
      )}
      {...props}
    />
  )
}

export function CardHeading({ className, children, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('text-[15px] font-semibold text-neutral-900', className)} {...props}>
      {children}
    </h2>
  )
}

/** Uppercase overline used as section and card labels. */
export function SectionLabel({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'text-[11px] font-bold tracking-[0.08em] text-neutral-400 uppercase',
        className,
      )}
      {...props}
    />
  )
}
