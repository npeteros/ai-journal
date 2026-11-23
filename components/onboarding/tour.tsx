'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { motion } from 'motion/react'
import { ArrowLeft, X } from 'lucide-react'

import { Jaden } from '@/components/jaden'
import { EASE_OUT } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { TOUR_STEPS, type TourStepDef } from './tour-steps'

type Measurable = { getBoundingClientRect: () => DOMRect }

const LG_BREAKPOINT = 1024
const SPOTLIGHT_PADDING = 6
const JADEN_SIZE = 56
/** Matches the `[data-tour-glide]` transition in globals.css. */
const GLIDE_MS = 380

/** First element for `id` that is actually on screen (sidebar on desktop, tab bar on mobile). */
export function findTourAnchor(id: string, root: ParentNode = document): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)
  for (const el of candidates) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && el.getClientRects().length > 0) return el
  }
  return null
}

function sideFor(rect: DOMRect): 'right' | 'top' | 'bottom' {
  if (window.innerWidth >= LG_BREAKPOINT && rect.left < 300) return 'right'
  return rect.top > window.innerHeight / 2 ? 'top' : 'bottom'
}

/** Re-renders on resize and scroll so the spotlight and popover follow their anchor. */
function useViewportTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('resize', bump)
    window.addEventListener('scroll', bump, true)
    return () => {
      window.removeEventListener('resize', bump)
      window.removeEventListener('scroll', bump, true)
    }
  }, [])
}

type TourProps = {
  steps?: readonly TourStepDef[]
  onFinish: (outcome: 'completed' | 'dismissed') => void
}

/**
 * Tooltip tour over the app shell. Steps without a visible anchor are skipped. Esc or "Skip tour"
 * dismisses; finishing the last step completes. Clicks outside don't close it, so a stray tap
 * doesn't end the tour.
 */
export function Tour({ steps = TOUR_STEPS, onFinish }: TourProps) {
  useViewportTick()
  const [index, setIndex] = useState(0)
  // True only while moving between steps, so the spotlight and popover glide on Next/Back but
  // still follow scrolling and resizing instantly.
  const [gliding, setGliding] = useState(false)
  useEffect(() => {
    if (!gliding) return
    const timer = window.setTimeout(() => setGliding(false), GLIDE_MS + 40)
    return () => window.clearTimeout(timer)
  }, [gliding, index])

  const goTo = (next: number) => {
    setGliding(true)
    setIndex(next)
  }
  const [anchors, setAnchors] = useState<{ step: TourStepDef; el: HTMLElement }[] | null>(null)

  // Resolve anchors after the shell has painted; recompute when the layout switches breakpoint.
  const resolve = useCallback(() => {
    setAnchors(
      steps.flatMap((step) => {
        const el = findTourAnchor(step.id)
        return el ? [{ step, el }] : []
      }),
    )
  }, [steps])

  useEffect(() => {
    const frame = requestAnimationFrame(resolve)
    const query = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`)
    query.addEventListener('change', resolve)
    return () => {
      cancelAnimationFrame(frame)
      query.removeEventListener('change', resolve)
    }
  }, [resolve])

  const current = anchors?.[Math.min(index, anchors.length - 1)]
  // A plain ref-shaped object (not useRef) so the popover re-anchors when the step changes.
  const anchorRef = useMemo<{ current: Measurable | null }>(
    () => ({ current: current?.el ?? null }),
    [current],
  )

  useEffect(() => {
    current?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  // Nothing to point at (unusual layout): end quietly rather than show an empty tour.
  useEffect(() => {
    if (anchors && anchors.length === 0) onFinish('dismissed')
  }, [anchors, onFinish])

  const total = anchors?.length ?? 0
  const position = Math.min(index, total - 1)
  const isLast = position === total - 1
  if (!current) return null
  // Read on every render; useViewportTick re-renders on scroll and resize.
  const liveRect = current.el.getBoundingClientRect()

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div
          data-tour-glide={gliding ? '' : undefined}
          className="absolute rounded-[14px] shadow-[0_0_0_9999px_rgb(0_0_0/0.35)] ring-2 ring-sage-500"
          style={{
            top: liveRect.top - SPOTLIGHT_PADDING,
            left: liveRect.left - SPOTLIGHT_PADDING,
            width: liveRect.width + SPOTLIGHT_PADDING * 2,
            height: liveRect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      </motion.div>

      <Popover.Root open>
        <Popover.Anchor virtualRef={anchorRef} />
        <Popover.Portal>
          {/* Not keyed by step: one popover stays open and glides to each anchor. */}
          <Popover.Content
            data-tour-glide={gliding ? '' : undefined}
            side={sideFor(liveRect)}
            align="center"
            sideOffset={14}
            collisionPadding={16}
            onEscapeKeyDown={() => onFinish('dismissed')}
            onInteractOutside={(event) => event.preventDefault()}
            aria-label={`Tour step ${position + 1} of ${total}: ${current.step.title}`}
            className="lv-card z-50 flex w-[min(348px,calc(100vw-32px))] flex-col gap-3 rounded-[18px] p-4 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="flex items-start gap-3">
              {/* Keyed by step so each stop gets a fresh reaction; Jaden pops in on the first. */}
              <div className="shrink-0 pt-1" style={{ width: JADEN_SIZE }}>
                <Jaden
                  key={current.step.id}
                  size={JADEN_SIZE}
                  mood={current.step.jaden.mood}
                  gesture={current.step.jaden.gesture}
                  entrance={position === 0 && !gliding ? 'arrive' : 'none'}
                  petable={false}
                />
              </div>
              {/* The text fades in as the card arrives at its new anchor. */}
              <motion.div
                key={current.step.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE_OUT, delay: gliding ? 0.1 : 0 }}
                className="flex min-w-0 flex-1 flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                      {position + 1} of {total}
                    </p>
                    <Popover.Title className="mt-1 font-serif text-[18px] leading-tight font-semibold text-neutral-900">
                      {current.step.title}
                    </Popover.Title>
                  </div>
                  <button
                    type="button"
                    aria-label="Skip tour"
                    onClick={() => onFinish('dismissed')}
                    className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </div>
                <Popover.Description className="text-[14px] leading-snug text-neutral-600">
                  {current.step.body}
                </Popover.Description>
              </motion.div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              {position > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(position - 1)}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-400 hover:text-neutral-900"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onFinish('dismissed')}
                  className="text-[13px] font-semibold text-neutral-400 hover:text-neutral-900"
                >
                  Skip tour
                </button>
              )}
              <Button
                type="button"
                variant="ink"
                size="pill"
                onClick={() => (isLast ? onFinish('completed') : goTo(position + 1))}
              >
                {isLast ? 'Done' : 'Next'}
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
