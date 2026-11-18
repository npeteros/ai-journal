'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { Rise } from '@/components/motion'
import { AiLabel } from '@/components/ui/ai'
import { Card, CardHeading } from '@/components/ui/card'
import { BarList } from '@/components/insights/bar-list'
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
  evidence: { id: string; entryDate: string | Date }[]
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

export function PersonalityInsights() {
  const trpc = useTRPC()
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null)
  const previousStatus = useRef<PersonalityData['status'] | undefined>(undefined)
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
    return (
      <Card className="flex min-h-[260px] flex-col justify-center gap-3 lg:p-6">
        <AiLabel />
        <CardHeading>
          {generating ? 'Preparing your reflection' : 'Reflection unavailable'}
        </CardHeading>
        <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
          {generating
            ? pollInterval
              ? 'We are reviewing patterns in your writing. This can take a few minutes.'
              : 'Your reflection is still being prepared. Check back shortly.'
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
            <CardHeading>The Big Five</CardHeading>
            <BarList
              tone="cloud"
              data={profile.traits.map((trait) => ({
                label: trait.label,
                value: trait.score,
                meta: trait.level,
              }))}
              seriesLabel="Reflection score"
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
        <dl className="flex flex-col gap-3">
          {profile.traits.map((trait) => (
            <div key={trait.trait} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-[13px] text-neutral-500 sm:w-40">
                {trait.label} is based on
              </dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                {trait.evidence.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/journal/${entry.id}`}
                    aria-label={`${trait.label}: journal entry from ${formatDate(entry.entryDate)}`}
                    className="text-[13px] font-semibold text-cloud-700 hover:underline"
                  >
                    {formatDate(entry.entryDate)}
                  </Link>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="text-[12px] leading-relaxed text-neutral-400">
        This is an AI reflection of patterns in your writing, not a psychological assessment.
      </p>
    </div>
  )
}
