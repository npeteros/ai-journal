'use client'

/**
 * Motion presets for JADEN, built on `motion` (motion/react).
 * One-shot entrances (rise, bubble pop, bar grow, line draw, dot pop) live here so they can fire
 * on mount / when scrolled into view. Ambient loops stay in app/life.css.
 * Reduced motion is honoured globally via <MotionConfig reducedMotion="user"> in ThemeProvider.
 */
import type { ComponentProps, ReactNode } from 'react'
import { motion, type Transition } from 'motion/react'

/** --ease-out from the design tokens */
export const EASE_OUT = [0.2, 0.75, 0.2, 1] as const
export const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 22 }

type RiseProps = ComponentProps<typeof motion.div> & {
  /** stagger index: each step adds 70ms of delay */
  i?: number
  children?: ReactNode
}

/** lv-rise: fade + rise + un-blur, staggered by index (70ms steps, 120ms base). */
export function Rise({ i = 0, children, transition, ...props }: RiseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay: i * 0.07 + 0.12, ...transition }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** lv-fade: slow fade-in. */
export function FadeIn({ i = 0, children, transition, ...props }: RiseProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4, ease: 'easeOut', delay: i * 0.08 + 0.5, ...transition }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

type BubbleProps = RiseProps & { from?: 'left' | 'right' }

/** lv-bubble: chat bubbles pop in from their tail corner. */
export function BubbleIn({
  i = 0,
  from = 'right',
  children,
  transition,
  style,
  ...props
}: BubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: i * 0.26 + 0.2, ...transition }}
      style={{ transformOrigin: from === 'right' ? '100% 100%' : '0% 100%', ...style }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

type GrowBarProps = Omit<ComponentProps<typeof motion.div>, 'children'> & {
  /** 0–100 */
  value: number
  i?: number
}

/** lv-grow: a horizontal bar that grows from the left when it scrolls into view. */
export function GrowBar({ value, i = 0, className, style, ...props }: GrowBarProps) {
  return (
    <motion.div
      className={className}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: EASE_OUT, delay: i * 0.09 + 0.35 }}
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        transformOrigin: 'left center',
        ...style,
      }}
      {...props}
    />
  )
}

type DrawPathProps = ComponentProps<typeof motion.path> & { delay?: number }

/** lv-draw: an SVG line that draws itself in. */
export function DrawPath({ delay = 0.35, transition, ...props }: DrawPathProps) {
  return (
    <motion.path
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.8, ease: EASE_OUT, delay, ...transition }}
      {...props}
    />
  )
}

type PopDotProps = ComponentProps<typeof motion.circle> & { i?: number }

/** lv-dot: chart points pop in after the line. */
export function PopDot({ i = 0, transition, ...props }: PopDotProps) {
  return (
    <motion.circle
      initial={{ scale: 0 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true }}
      transition={{ ...SPRING, delay: i * 0.11 + 0.7, ...transition }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      {...props}
    />
  )
}
