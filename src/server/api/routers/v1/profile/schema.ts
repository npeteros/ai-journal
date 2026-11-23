import { z } from 'zod'

// Client-safe: imported by the welcome card and Settings form, so no Prisma or server imports here.

export const FOCUS_AREAS = [
  { id: 'stress', label: 'Stress & anxiety' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'work', label: 'Work & career' },
  { id: 'self-discovery', label: 'Self-discovery' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'health', label: 'Health & habits' },
  { id: 'change', label: 'Grief & change' },
  { id: 'creativity', label: 'Creativity' },
] as const

export type FocusAreaId = (typeof FOCUS_AREAS)[number]['id']

const FOCUS_AREA_IDS = FOCUS_AREAS.map((area) => area.id) as [FocusAreaId, ...FocusAreaId[]]

/** Mirrors the Prisma `CompanionTone` enum (checked in `UserProfileService`). */
export const COMPANION_TONES = ['GENTLE', 'DIRECT', 'PLAYFUL'] as const
export type CompanionToneValue = (typeof COMPANION_TONES)[number]

export const FOCUS_AREAS_MAX = 3
export const FOCUS_AREA_OTHER_MAX_LENGTH = 80
export const GOAL_MAX_LENGTH = 280
export const CURRENT_CONTEXT_MAX_LENGTH = 500

/** Trims, and turns an empty answer into `null` so a skipped question clears the stored value. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null))

export const SaveAboutSchema = z.object({
  focusAreas: z
    .array(z.enum(FOCUS_AREA_IDS))
    .max(FOCUS_AREAS_MAX)
    .transform((areas) => [...new Set(areas)]),
  focusAreaOther: optionalText(FOCUS_AREA_OTHER_MAX_LENGTH),
  goal: optionalText(GOAL_MAX_LENGTH),
  currentContext: optionalText(CURRENT_CONTEXT_MAX_LENGTH),
  preferredTone: z
    .enum(COMPANION_TONES)
    .nullish()
    .transform((value) => value ?? null),
})

export type SaveAboutInput = z.input<typeof SaveAboutSchema>
export type SaveAboutData = z.output<typeof SaveAboutSchema>

export const TourOutcomeSchema = z.object({ outcome: z.enum(['completed', 'dismissed']) })

export type ProfileAnswers = SaveAboutData

export type OnboardingState = {
  /** Neither answered nor skipped the welcome card yet. */
  showWelcome: boolean
  /** Welcome card handled, tour neither completed nor dismissed. */
  showTour: boolean
}

export type ProfileResponse = { answers: ProfileAnswers; onboarding: OnboardingState }
