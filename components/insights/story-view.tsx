'use client'

import { useState } from 'react'
import { motion } from 'motion/react'

import { EASE_OUT, Rise } from '@/components/motion'
import { Card } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/controls'
import { cssVar, moodColor } from '@/src/lib/design-tokens/colors'
import type {
  StoryRange,
  storyMonths as StoryMonths,
  storyQuote as StoryQuote,
} from '@/src/lib/placeholder/insights'

const RANGES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const satisfies readonly { value: StoryRange; label: string }[]

/** "Your story": range switcher, vertical mood timeline, and a quote card. */
export function StoryView({
  months,
  quote,
}: {
  months: typeof StoryMonths
  quote: typeof StoryQuote
}) {
  const [range, setRange] = useState<StoryRange>('monthly')

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-[18px] text-neutral-600 italic">
          Your story, told a month at a time
        </p>
        <SegmentedControl
          id="story-range"
          aria-label="Story range"
          options={RANGES}
          value={range}
          onValueChange={setRange}
          className="self-start"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Placeholder: only the monthly rollup exists in mock data; other ranges reuse it. */}
        <ol key={range} className="relative flex flex-col gap-5 pl-8">
          <motion.span
            aria-hidden
            className="absolute top-2 bottom-2 left-[9px] w-0.5 origin-top rounded-full bg-neutral-200"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.2, ease: EASE_OUT }}
          />
          {months.map((m, i) => (
            <li key={m.month} className="relative">
              <motion.span
                aria-hidden
                className="absolute top-6 -left-8 size-5 rounded-full border-4 border-bg"
                style={{ background: cssVar(moodColor[m.mood]) }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 + i * 0.15 }}
              />
              <Rise i={i + 1}>
                <Card className="flex flex-col gap-2">
                  <h2 className="font-serif text-[20px] font-semibold text-neutral-900">
                    {m.month}
                  </h2>
                  <p className="text-[13px] leading-normal text-neutral-600">{m.summary}</p>
                  <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 font-serif text-[15px] leading-relaxed text-neutral-900 italic">
                    &ldquo;{m.quote}&rdquo;
                  </blockquote>
                </Card>
              </Rise>
            </li>
          ))}
        </ol>

        <Rise i={2} className="lg:sticky lg:top-10 lg:self-start">
          <Card className="flex flex-col gap-4 lg:p-7">
            <span className="text-[11px] font-bold tracking-[0.08em] text-amber-700 uppercase">
              This month, in your words
            </span>
            <p className="font-serif text-[22px] leading-[1.45] text-neutral-900 italic">
              &ldquo;{quote.text}&rdquo;
            </p>
            <span className="text-[12px] font-semibold text-neutral-400">{quote.source}</span>
          </Card>
        </Rise>
      </div>
    </>
  )
}
