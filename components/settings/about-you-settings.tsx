'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Compass } from 'lucide-react'

import { Rise } from '@/components/motion'
import { AboutYouForm } from '@/components/onboarding/about-you-form'
import { ONBOARDING_PATH } from '@/components/onboarding/onboarding-host'
import { Button } from '@/components/ui/button'
import type { ProfileResponse } from '@/src/server/api/routers/v1/profile/schema'
import { useHydrated } from '@/src/lib/use-hydrated'
import { useTRPC } from '@/src/server/trpc/client'
import { SettingsSection } from './settings-ui'

/** Settings → About you: edit the onboarding answers and replay the product tour. */
export function AboutYouSettings() {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: queryData, isError } = useQuery(trpc.v1.profile.get.queryOptions())
  // Same markup on the server and the hydration render, even if the streamed query lands between.
  const data = useHydrated() ? queryData : undefined
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const replay = useMutation(
    trpc.v1.profile.replayTour.mutationOptions({
      onSuccess: (onboarding) => {
        queryClient.setQueryData(
          trpc.v1.profile.get.queryKey(),
          (prev: ProfileResponse | undefined) => (prev ? { ...prev, onboarding } : prev),
        )
        router.push(ONBOARDING_PATH)
      },
    }),
  )

  return (
    <>
      <Rise i={0}>
        <div className="lv-card rounded-[18px] p-5 sm:p-6">
          {data ? (
            <AboutYouForm
              // Remount after a save so the form starts from the saved answers.
              key={savedAt ?? 'initial'}
              mode="settings"
              initial={data.answers}
              onSaved={() => setSavedAt(Date.now())}
            />
          ) : (
            <p className="text-[14px] text-neutral-400">
              {isError ? 'We couldn’t load your answers. Refresh to try again.' : 'Loading…'}
            </p>
          )}
          {savedAt && (
            <output className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-sage-700">
              <Check className="size-4" strokeWidth={2.4} />
              Saved. Jaden will use this from your next conversation.
            </output>
          )}
        </div>
      </Rise>

      <SettingsSection label="Product tour" i={1}>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Compass className="size-[18px] text-neutral-600" strokeWidth={2} />
            <div>
              <p className="text-[14px] font-medium text-neutral-900">Replay the tour</p>
              <p className="text-[12px] text-neutral-400">
                A quick walk through the app’s main areas.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="soft"
            size="pill"
            disabled={replay.isPending}
            onClick={() => replay.mutate()}
          >
            {replay.isPending ? 'Starting…' : 'Replay'}
          </Button>
        </div>
        {replay.isError && (
          <p role="alert" className="px-4 py-3 text-[13px] text-neutral-900">
            We couldn’t start the tour. Try again.
          </p>
        )}
      </SettingsSection>
    </>
  )
}
