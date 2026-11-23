'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { OnboardingState, ProfileResponse } from '@/src/server/api/routers/v1/profile/schema'
import { useHydrated } from '@/src/lib/use-hydrated'
import { useTRPC } from '@/src/server/trpc/client'
import { AboutYouForm } from './about-you-form'
import { WELCOME_INTRO } from './welcome-questions'
import { Tour } from './tour'

/** First-run onboarding starts only on the journal home, never mid-entry or mid-chat. */
export const ONBOARDING_PATH = '/journal'

/**
 * Mounted once in the app shell. Shows the "Tell Jaden about you" card, then the tooltip tour,
 * based on `profile.get` (prefetched by the app layout). Both are skippable, and each outcome is
 * saved so neither comes back unless replayed from Settings.
 */
export function OnboardingHost() {
  const pathname = usePathname()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data } = useQuery(trpc.v1.profile.get.queryOptions())
  const hydrated = useHydrated()

  const setOnboarding = useCallback(
    (onboarding: OnboardingState) =>
      queryClient.setQueryData(
        trpc.v1.profile.get.queryKey(),
        (prev: ProfileResponse | undefined) => (prev ? { ...prev, onboarding } : prev),
      ),
    [queryClient, trpc],
  )

  const skipWelcome = useMutation(
    trpc.v1.profile.skipWelcome.mutationOptions({ onSuccess: setOnboarding }),
  )
  const finishTour = useMutation(
    trpc.v1.profile.finishTour.mutationOptions({ onSuccess: setOnboarding }),
  )

  const { mutate: finishTourMutate } = finishTour
  const onTourFinish = useCallback(
    (outcome: 'completed' | 'dismissed') => {
      // Hide right away rather than waiting for the round trip.
      setOnboarding({ showWelcome: false, showTour: false })
      finishTourMutate({ outcome })
    },
    [finishTourMutate, setOnboarding],
  )

  // Client-only UI: render nothing until hydrated so the server and first client render match.
  if (!hydrated || !data || pathname !== ONBOARDING_PATH) return null
  const { showWelcome, showTour } = data.onboarding

  if (showWelcome) {
    return (
      <Dialog.Root
        open
        onOpenChange={(open) => {
          // Esc counts as "Skip for now".
          if (!open && !skipWelcome.isPending) skipWelcome.mutate()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-[2px]" />
          <Dialog.Content
            onInteractOutside={(event) => event.preventDefault()}
            className="lv-card fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] p-6 outline-none sm:p-8"
          >
            <Dialog.Title className="sr-only">{WELCOME_INTRO.title}</Dialog.Title>
            <Dialog.Description className="sr-only">{WELCOME_INTRO.body}</Dialog.Description>
            <AboutYouForm
              mode="welcome"
              initial={data.answers}
              onSkipAll={() => skipWelcome.mutate()}
              skipping={skipWelcome.isPending}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  if (showTour) return <Tour onFinish={onTourFinish} />
  return null
}
