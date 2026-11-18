'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AnimatePresence, motion } from 'motion/react'
import { CircleHelp } from 'lucide-react'
import { Popover } from 'radix-ui'

import { EntryPreviewPanel } from '@/components/chat/entry-preview-panel'
import { EASE_OUT, Rise } from '@/components/motion'
import { AiLabel, Orb, TypingIndicator } from '@/components/ui/ai'
import { Card, CardHeading } from '@/components/ui/card'
import { BarList } from '@/components/insights/bar-list'
import { EvidenceRow, type EvidencePreview } from '@/components/insights/evidence-row'
import { PERSONALITY_PROFILE_LOCK_TIMEOUT_MS } from '@/src/server/api/routers/v1/insights/personality-schema'
import { useTRPC } from '@/src/server/trpc/client'

const PERSONALITY_POLL_INTERVAL_MS = 4_000
// A run can hold its lease for up to the lock timeout, so polling covers that whole window.
export const PERSONALITY_POLL_TIMEOUT_MS = PERSONALITY_PROFILE_LOCK_TIMEOUT_MS

type Trait = {
  trait: string
  label: string
  score: number
  level: 'Low' | 'Moderate' | 'High'
  evidence: { id: string; title: string; entryDate: string | Date }[]
}

type Profile = {
  traits: Trait[]
  summary: string
  meaning: string
  basedOn: number
  generatedAt: string | Date
}

export type PersonalityData = {
  status: 'ready' | 'updating' | 'notEnoughEntries'
  profile: Profile | null
  remainingEntries: number
  retryAfter: string | Date | null
  unavailable: boolean
}

export function nextPersonalityPollInterval(
  data: PersonalityData | undefined,
  pollingStartedAt: number | null,
  now = Date.now(),
): number | false {
  if (data?.status !== 'updating' || data.retryAfter || pollingStartedAt === null) return false
  return now - pollingStartedAt < PERSONALITY_POLL_TIMEOUT_MS ? PERSONALITY_POLL_INTERVAL_MS : false
}

// Both values are UTC-anchored server dates, so format in UTC to avoid an off-by-one day.
function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  )
}

// Plain-language definitions for people new to the Big Five. Both ends of every trait are
// described neutrally; neither is the "good" one.
export const BIG_FIVE_GUIDE = [
  {
    label: 'Openness',
    about: 'Curiosity about ideas, art and new experiences.',
    higher: 'drawn to novelty, imagination and variety',
    lower: 'prefers the familiar, practical and proven',
  },
  {
    label: 'Conscientiousness',
    about: 'How you organize your time and follow through.',
    higher: 'planned, steady and detail-minded',
    lower: 'flexible, spontaneous and easygoing',
  },
  {
    label: 'Extraversion',
    about: 'Where you get your energy.',
    higher: 'recharged by people and activity',
    lower: 'recharged by quiet and time alone',
  },
  {
    label: 'Agreeableness',
    about: 'How you approach other people.',
    higher: 'warm, cooperative and trusting',
    lower: 'direct, questioning and independent',
  },
  {
    label: 'Emotional stability',
    about: 'How steady your mood stays when things get stressful.',
    higher: 'calm and even-keeled under pressure',
    lower: 'feels worry and stress more intensely',
  },
] as const

/**
 * "What are these?" next to the Big Five heading. A popover, so opening it never pushes the page
 * down, and each trait reads as a low-to-high spectrum rather than a paragraph.
 */
function BigFiveGuide() {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-cloud-700 hover:bg-cloud-100/70 data-[state=open]:bg-cloud-100/70">
        <CircleHelp aria-hidden className="size-3.5" />
        What are these?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="lv-card z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-4 rounded-2xl p-5 outline-none"
        >
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-neutral-900">The Big Five</p>
            <p className="text-[12px] leading-relaxed text-neutral-500">
              A widely used way to describe personality. Each trait is a spectrum, and neither end
              is better.
            </p>
          </div>
          <ul className="flex flex-col gap-3.5">
            {BIG_FIVE_GUIDE.map((trait) => (
              <li key={trait.label} className="flex flex-col gap-1.5">
                <p className="text-[13px] text-neutral-900">
                  <span className="font-semibold">{trait.label}</span>
                  <span className="text-neutral-500"> · {trait.about}</span>
                </p>
                <div
                  aria-hidden
                  className="h-1.5 rounded-full bg-linear-to-r from-cloud-100 to-cloud-500"
                />
                <p className="flex justify-between gap-4 text-[11px] leading-snug text-neutral-500">
                  <span>
                    <span className="sr-only">Lower: </span>
                    {trait.lower}
                  </span>
                  <span className="text-right">
                    <span className="sr-only">Higher: </span>
                    {trait.higher}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function PersonalitySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading reflection" className="flex flex-col gap-5">
      <div className="h-3 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="grid animate-pulse gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-4 lg:p-6">
          <div className="h-3 w-28 rounded bg-neutral-200" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 w-full rounded bg-neutral-100" />
          ))}
        </Card>
        <Card className="flex flex-col gap-3 lg:p-6">
          <div className="h-3 w-24 rounded bg-neutral-200" />
          <div className="h-3 w-full rounded bg-neutral-100" />
          <div className="h-3 w-5/6 rounded bg-neutral-100" />
        </Card>
      </div>
    </div>
  )
}

// Describes what the reflection draws on. It is not real progress, so it holds on the last step
// rather than looping or implying a percentage.
export const PREPARING_STEPS = [
  'Reading your recent entries',
  'Noticing themes that keep coming back',
  'Looking at how you plan, connect and unwind',
  'Shaping your Big Five reflection',
] as const
const PREPARING_STEP_MS = 4_000
const PREVIEW_TRAITS = [
  ['Openness', 'w-3/4'],
  ['Conscientiousness', 'w-1/2'],
  ['Extraversion', 'w-2/3'],
  ['Agreeableness', 'w-3/5'],
  ['Emotional stability', 'w-2/5'],
] as const

function PreparingReflection() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= PREPARING_STEPS.length - 1) return
    const timer = window.setTimeout(() => setStep((current) => current + 1), PREPARING_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [step])

  return (
    <Card className="flex min-h-[260px] flex-col gap-6 lg:flex-row lg:items-center lg:gap-10 lg:p-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Orb size={36} />
          <div className="flex flex-col gap-0.5">
            <AiLabel />
            <CardHeading>Preparing your reflection</CardHeading>
          </div>
        </div>

        {/* The rotating line is decorative; screen readers get one stable announcement. */}
        <output className="sr-only">
          Your reflection is being prepared. This can take a few minutes.
        </output>
        <div aria-hidden className="flex min-h-[22px] items-center gap-3">
          <TypingIndicator />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="text-[14px] text-neutral-700"
            >
              {PREPARING_STEPS[step]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p aria-hidden className="text-[12px] text-neutral-400">
          This can take a few minutes. You can leave this page; it will be ready when you return.
        </p>
      </div>

      <div aria-hidden className="flex flex-col gap-3 lg:w-[42%]">
        {PREVIEW_TRAITS.map(([label, width], index) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-[12px] text-neutral-400">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full bg-cloud-200 motion-safe:animate-pulse ${width}`}
                style={{ animationDelay: `${index * 180}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function PersonalityInsights() {
  const trpc = useTRPC()
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null)
  const previousStatus = useRef<PersonalityData['status'] | undefined>(undefined)
  const [preview, setPreview] = useState<EvidencePreview | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const query = useQuery({
    ...trpc.v1.insights.personality.queryOptions(),
    refetchInterval: (currentQuery) =>
      nextPersonalityPollInterval(
        currentQuery.state.data as PersonalityData | undefined,
        pollingStartedAt,
      ),
  })
  const data = query.data as PersonalityData | undefined
  const pollInterval = nextPersonalityPollInterval(data, pollingStartedAt)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (data?.status === 'updating' && !data.retryAfter) {
        setPollingStartedAt((current) => current ?? Date.now())
      } else if (data?.status !== previousStatus.current) {
        setPollingStartedAt(null)
      }
      previousStatus.current = data?.status
    })
    return () => window.clearTimeout(timer)
  }, [data?.retryAfter, data?.status])

  if (!data && !query.isError) return <PersonalitySkeleton />

  if (data?.status === 'notEnoughEntries') {
    const analyzedEntries = Math.max(0, 20 - data.remainingEntries)
    return (
      <Card className="flex min-h-[260px] flex-col justify-center gap-3 lg:p-6">
        <AiLabel />
        <CardHeading>Your reflection is building</CardHeading>
        <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
          You have {analyzedEntries} analyzed {analyzedEntries === 1 ? 'entry' : 'entries'}. Add{' '}
          {data.remainingEntries} more {data.remainingEntries === 1 ? 'entry' : 'entries'} to
          prepare this reflection.
        </p>
      </Card>
    )
  }

  if (!data?.profile) {
    const generating = data?.status === 'updating'
    // Polling starts one tick after the first render, so only a finished poll window counts as
    // stalled; otherwise the animated state would flash its static fallback on mount.
    const pollingStalled = pollingStartedAt !== null && pollInterval === false
    if (generating && !data.retryAfter && !pollingStalled) return <PreparingReflection />

    return (
      <Card className="flex min-h-[260px] flex-col justify-center gap-3 lg:p-6">
        <AiLabel />
        <CardHeading>
          {generating ? 'Preparing your reflection' : 'Reflection unavailable'}
        </CardHeading>
        <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
          {generating
            ? 'Your reflection is still being prepared. Check back shortly.'
            : 'Your reflection could not be prepared just now. Please check back later.'}
        </p>
      </Card>
    )
  }

  const profile = data.profile
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-400">
        <span>
          Based on {profile.basedOn} {profile.basedOn === 1 ? 'entry' : 'entries'}
        </span>
        <span aria-hidden>·</span>
        <span>Generated {formatDate(profile.generatedAt)}</span>
        {data.status === 'updating' && (
          <output className="ml-1 text-cloud-700">
            {pollInterval ? 'Updating reflection...' : 'Reflection is still updating.'}
          </output>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Rise>
          <Card className="flex flex-col gap-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <CardHeading>The Big Five</CardHeading>
              <BigFiveGuide />
            </div>
            <BarList
              tone="cloud"
              data={profile.traits.map((trait) => ({
                label: trait.label,
                value: trait.score,
                meta: trait.level,
                hint: BIG_FIVE_GUIDE.find((guide) => guide.label === trait.label)?.about,
              }))}
              seriesLabel="Reflection score"
              unit=" / 100"
              label={`The Big Five reflection: ${profile.traits.map((trait) => `${trait.label} ${trait.level}`).join(', ')}.`}
            />
            <p className="text-[12px] leading-relaxed text-neutral-500">
              These scores describe observed writing patterns, not better or worse traits.
            </p>
          </Card>
        </Rise>
        <Rise i={1}>
          <Card className="flex flex-col gap-3 lg:p-6">
            <AiLabel />
            <CardHeading>What this means</CardHeading>
            <p className="font-serif text-[18px] leading-relaxed text-neutral-900 italic">
              {profile.meaning}
            </p>
          </Card>
        </Rise>
      </div>

      <Card className="flex flex-col gap-4 lg:p-6">
        <CardHeading>In your writing</CardHeading>
        <p className="max-w-3xl text-[14px] leading-relaxed text-neutral-700">{profile.summary}</p>
        <div className="flex flex-col">
          <p className="pb-1 text-[11px] font-semibold tracking-[0.05em] text-neutral-400 uppercase">
            What each trait is based on
          </p>
          <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
            {profile.traits.map((trait) => (
              <li key={trait.trait}>
                <EvidenceRow
                  summary={<span className="text-[14px] text-neutral-800">{trait.label}</span>}
                  aside={`${trait.evidence.length} ${trait.evidence.length === 1 ? 'entry' : 'entries'}`}
                  entries={trait.evidence}
                  citedFor={trait.label}
                  onOpen={setPreview}
                />
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <p className="text-[12px] leading-relaxed text-neutral-400">
        This is an AI reflection of patterns in your writing, not a psychological assessment.
      </p>

      <EntryPreviewPanel
        entry={preview?.entry ?? null}
        label={preview?.label}
        onClose={closePreview}
      />
    </div>
  )
}
