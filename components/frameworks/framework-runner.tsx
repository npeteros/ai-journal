'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'motion/react'

import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import type { PlaceholderFramework } from '@/src/lib/placeholder/frameworks'
import { FrameworkIcon } from './framework-icon'

/** Guided entry: numbered prompts, each with its own answer field. */
export function FrameworkRunner({ framework }: { framework: PlaceholderFramework }) {
  const [answers, setAnswers] = useState(() => framework.prompts.map((p) => p.sample ?? ''))
  const answered = answers.filter((a) => a.trim()).length

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/frameworks"
          className="text-[15px] font-medium text-neutral-400 hover:text-neutral-600"
        >
          Cancel
        </Link>
        <Button asChild variant="ink-flat" size="md" className="px-[22px] text-[14px]">
          {/* Placeholder: saving a framework entry creates a journal entry */}
          <Link href="/journal">Done</Link>
        </Button>
      </div>

      <Rise className="flex items-center gap-2.5">
        <FrameworkIcon name={framework.icon} size={32} />
        <h1 className="font-serif text-[22px] leading-[1.3] font-semibold text-neutral-900 lg:text-[26px]">
          {framework.title}
        </h1>
      </Rise>

      <div className="h-1 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-sage-500"
          initial={false}
          animate={{ width: `${(answered / framework.prompts.length) * 100}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
        />
      </div>

      <ol className="flex flex-col gap-6">
        {framework.prompts.map((p, i) => (
          <li key={p.prompt}>
            <Rise i={i + 1} className="flex flex-col gap-2">
              <label htmlFor={`prompt-${i}`} className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-surface">
                  {i + 1}
                </span>
                <span className="text-[14px] leading-[1.3] font-semibold text-neutral-900 lg:text-[15px]">
                  {p.prompt}
                </span>
              </label>
              <textarea
                id={`prompt-${i}`}
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                }
                placeholder="Write a few lines…"
                className="field-sizing-content min-h-[52px] resize-none rounded-xl bg-transparent py-1 pl-7 text-[14px] leading-[1.6] text-neutral-600 caret-cloud-500 outline-none placeholder:text-neutral-400 focus:text-neutral-900 lg:text-[15px]"
              />
            </Rise>
          </li>
        ))}
      </ol>
    </div>
  )
}
