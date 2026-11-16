'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/src/server/trpc/client' // verify this path against components/journal/entry-list.tsx

type Prompt = { prompt: string; sample?: string }
type FrameworkData = {
  id: string
  slug: string
  title: string
  description: string
  minutes: number
  prompts: Prompt[]
}

/** Runs a framework one prompt at a time, then saves it as a journal entry. */
export function FrameworkRunner({ framework }: { framework: FrameworkData }) {
  const router = useRouter()
  const total = framework.prompts.length
  const [step, setStep] = useState(0)
  // Kept in state for the whole run, so going back a step never loses what was typed.
  const [answers, setAnswers] = useState<string[]>(() => framework.prompts.map(() => ''))

  const trpc = useTRPC()
  const complete = useMutation(
    trpc.v1.framework.complete.mutationOptions({
      onSuccess: ({ entryId }) => router.push(`/journal/${entryId}`),
    }),
  )

  const current = framework.prompts[step]
  if (!current)
    return <p className="py-6 text-[14px] text-neutral-400">This framework has no prompts.</p>

  const isLast = step === total - 1
  const hasAnswer = answers.some((a) => a.trim().length > 0)

  function setAnswer(value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === step ? value : a)))
  }

  function finish() {
    if (!hasAnswer || complete.isPending) return
    complete.mutate({
      frameworkId: framework.id,
      answers,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }

  return (
    <section className="flex flex-1 flex-col gap-5 py-4">
      <header>
        <p className="text-[12px] font-semibold tracking-wide text-neutral-400 uppercase">
          {framework.title} · Step {step + 1} of {total}
        </p>
        <progress
          value={step + 1}
          max={total}
          aria-label={`Step ${step + 1} of ${total}`}
          className="mt-3 block h-1 w-full appearance-none overflow-hidden rounded-full bg-neutral-200 [&::-moz-progress-bar]:bg-neutral-900 [&::-webkit-progress-bar]:bg-neutral-200 [&::-webkit-progress-value]:bg-neutral-900 [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-300"
        />
      </header>

      <h2 className="font-serif text-[24px] leading-tight font-semibold text-neutral-900">
        {current.prompt}
      </h2>

      <div>
        <label htmlFor="framework-answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="framework-answer"
          value={answers[step]}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={current.sample ?? 'Write whatever comes to mind…'}
          rows={7}
          className="lv-card w-full resize-none rounded-[18px] px-[18px] py-3.5 text-[15px] leading-[1.6] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {isLast && !hasAnswer && (
          <p className="mt-2 text-[13px] text-neutral-400">Answer at least one prompt to finish.</p>
        )}
        {complete.error && (
          <p role="alert" className="mt-2 text-[13px] text-neutral-900">
            We couldn’t save your entry. Your answers are still here, so try again.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {step === 0 ? (
          <Link
            href="/frameworks"
            className="text-[14px] font-semibold text-neutral-400 hover:text-neutral-900"
          >
            All frameworks
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 text-[14px] font-semibold text-neutral-400 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back
          </button>
        )}

        {isLast ? (
          <button
            type="button"
            onClick={finish}
            disabled={!hasAnswer || complete.isPending}
            className="flex h-[48px] items-center gap-2 rounded-full bg-neutral-900 px-6 text-[15px] font-semibold text-surface transition-opacity disabled:opacity-60"
          >
            {complete.isPending ? 'Saving…' : 'Finish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex h-[48px] items-center gap-2 rounded-full bg-neutral-900 px-6 text-[15px] font-semibold text-surface"
          >
            Next
            <ArrowRight className="size-[17px]" strokeWidth={2} />
          </button>
        )}
      </div>
    </section>
  )
}
