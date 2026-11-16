'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'

import { cn } from 'cn'

import { JadenFor, JadenPerch, PLACEMENTS, moodForScore } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { TypingIndicator } from '@/components/ui/ai'
import { Card, SectionLabel } from '@/components/ui/card'

/**
 * Where the entry's analysis stands:
 * - `listening`: not saved yet, so there is nothing to analyze.
 * - `analyzing`: a save is waiting for its (new) analysis.
 * - `ready`: show what the analysis found.
 * - `unavailable`: saved but no analysis (rate-limited or failed). Sections hide quietly.
 */
export type AiRailState = 'listening' | 'analyzing' | 'ready' | 'unavailable'

type AiRailProps = {
  state: AiRailState
  moodLabel?: string
  /** The entry's analyzed mood score (0–100); sets Jaden's expression. */
  moodScore?: number | null
  /** Suggestions not already on the entry. */
  suggestedTags?: string[]
  summary?: string[]
  onAcceptTag: (tag: string) => void
}

/** "For this entry": AI mood detection, suggested tags and a summary. */
export function AiRail({
  state,
  moodLabel,
  moodScore,
  suggestedTags = [],
  summary = [],
  onAcceptTag,
}: AiRailProps) {
  const hasMood = moodScore != null
  const showMoodPill = state === 'ready' && moodLabel
  const showStatus = state === 'listening' || state === 'analyzing'
  const showMoodCard = showStatus || showMoodPill || suggestedTags.length > 0
  const showSummary = summary.length > 0 || state === 'listening'

  return (
    <aside aria-label="For this entry" className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
      <SectionLabel className="text-[12px] tracking-[0.06em]">For this entry</SectionLabel>

      <Rise i={0} className="relative">
        {/* Jaden nods along on mobile; on desktop he only appears once he can react to the entry's mood */}
        <div className={cn(!hasMood && 'lg:hidden')}>
          <JadenPerch width={PLACEMENTS.editor.size} position={{ right: -8 }}>
            {hasMood ? (
              <JadenFor placement="editor" mood={moodForScore(moodScore)} />
            ) : (
              <JadenFor placement="editor" />
            )}
          </JadenPerch>
        </div>
        {showMoodCard && (
          <Card className="flex flex-col gap-2.5 rounded-[14px] p-4 lg:p-4">
            {state === 'analyzing' ? (
              <TypingIndicator label="Analyzing…" />
            ) : state === 'listening' ? (
              <TypingIndicator label="Listening as you write" />
            ) : (
              showMoodPill && (
                <span className="inline-flex w-fit items-center rounded-full bg-sage-100 py-[5px] pr-[11px] pl-[9px] text-[11px] leading-none font-semibold text-sage-700">
                  {moodLabel}
                </span>
              )
            )}
            {suggestedTags.length > 0 && (
              <>
                <p className="mt-1 text-[12px] leading-none font-semibold tracking-[0.04em] text-neutral-400 uppercase">
                  Suggested tags
                </p>
                <div className="flex min-h-[26px] flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {suggestedTags.map((t) => (
                      <motion.button
                        key={t}
                        type="button"
                        layout
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => onAcceptTag(t)}
                        className="flex items-center gap-[5px] rounded-full border-[1.5px] border-dashed border-sage-200 px-[11px] py-1.5 text-[12px] leading-none font-semibold text-sage-700 hover:bg-sage-100"
                      >
                        <Plus className="size-2.5" strokeWidth={2.5} />
                        {t}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </Card>
        )}
      </Rise>

      {showSummary && (
        <Rise i={1}>
          <Card className="flex flex-col gap-2.5 rounded-[14px] p-4 lg:p-4">
            <span className="text-[13px] font-semibold text-neutral-900">Summary</span>
            {summary.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-[13px] leading-normal text-neutral-600">
                {summary.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-sage-700" aria-hidden>
                      •
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-normal text-neutral-400">
                A short summary appears once you&apos;ve written a little more.
              </p>
            )}
          </Card>
        </Rise>
      )}
    </aside>
  )
}
