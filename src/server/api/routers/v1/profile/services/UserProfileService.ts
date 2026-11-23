import type { CompanionTone } from '@/src/generated/prisma/enums'
import prisma from '@/src/lib/prisma'
import {
  FOCUS_AREAS,
  type CompanionToneValue,
  type FocusAreaId,
  type OnboardingState,
  type ProfileAnswers,
  type ProfileResponse,
  type SaveAboutData,
} from '../schema'

// Compile-time check that the zod tone list and the Prisma enum stay in sync.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const tonesMatch: Same<CompanionTone, CompanionToneValue> = true
void tonesMatch

const KNOWN_FOCUS_AREAS = new Set<string>(FOCUS_AREAS.map((area) => area.id))

const PROFILE_SELECT = {
  focusAreas: true,
  focusAreaOther: true,
  goal: true,
  currentContext: true,
  preferredTone: true,
  welcomeAnsweredAt: true,
  welcomeSkippedAt: true,
  tourCompletedAt: true,
  tourDismissedAt: true,
} as const

type ProfileRow = {
  focusAreas: string[]
  focusAreaOther: string | null
  goal: string | null
  currentContext: string | null
  preferredTone: CompanionTone | null
  welcomeAnsweredAt: Date | null
  welcomeSkippedAt: Date | null
  tourCompletedAt: Date | null
  tourDismissedAt: Date | null
}

const EMPTY_ANSWERS: ProfileAnswers = {
  focusAreas: [],
  focusAreaOther: null,
  goal: null,
  currentContext: null,
  preferredTone: null,
}

function toAnswers(row: ProfileRow | null): ProfileAnswers {
  if (!row) return EMPTY_ANSWERS
  return {
    // Drops ids removed from FOCUS_AREAS since the row was written.
    focusAreas: row.focusAreas.filter((id): id is FocusAreaId => KNOWN_FOCUS_AREAS.has(id)),
    focusAreaOther: row.focusAreaOther,
    goal: row.goal,
    currentContext: row.currentContext,
    preferredTone: row.preferredTone,
  }
}

function toOnboarding(row: ProfileRow | null): OnboardingState {
  const showWelcome = !row?.welcomeAnsweredAt && !row?.welcomeSkippedAt
  const showTour = !showWelcome && !row?.tourCompletedAt && !row?.tourDismissedAt
  return { showWelcome, showTour }
}

/** Upserts the user's single profile row; the row is never deleted (reset nulls the timestamps). */
function upsert(
  userId: string,
  data: Partial<Omit<ProfileRow, 'focusAreas'>> & { focusAreas?: string[] },
) {
  return prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: PROFILE_SELECT,
  })
}

export const userProfileService = {
  async get(userId: string): Promise<ProfileResponse> {
    const row = await prisma.userProfile.findUnique({ where: { userId }, select: PROFILE_SELECT })
    return { answers: toAnswers(row), onboarding: toOnboarding(row) }
  },

  /** Answers only, for building agent prompts. `null` when the user has shared nothing. */
  async getAnswers(userId: string): Promise<ProfileAnswers | null> {
    const row = await prisma.userProfile.findUnique({ where: { userId }, select: PROFILE_SELECT })
    const answers = toAnswers(row)
    const hasAny =
      answers.focusAreas.length > 0 ||
      Boolean(
        answers.focusAreaOther || answers.goal || answers.currentContext || answers.preferredTone,
      )
    return hasAny ? answers : null
  },

  async saveAbout(userId: string, answers: SaveAboutData): Promise<ProfileResponse> {
    const row = await upsert(userId, { ...answers, welcomeAnsweredAt: new Date() })
    return { answers: toAnswers(row), onboarding: toOnboarding(row) }
  },

  async skipWelcome(userId: string): Promise<OnboardingState> {
    return toOnboarding(await upsert(userId, { welcomeSkippedAt: new Date() }))
  },

  async finishTour(userId: string, outcome: 'completed' | 'dismissed'): Promise<OnboardingState> {
    const now = new Date()
    const data = outcome === 'completed' ? { tourCompletedAt: now } : { tourDismissedAt: now }
    return toOnboarding(await upsert(userId, data))
  },

  /** Replays the tour only; the welcome answers are kept and edited from Settings. */
  async replayTour(userId: string): Promise<OnboardingState> {
    return toOnboarding(
      await upsert(userId, {
        // Keep the welcome card hidden even if it was never touched.
        welcomeSkippedAt: new Date(),
        tourCompletedAt: null,
        tourDismissedAt: null,
      }),
    )
  },
}
