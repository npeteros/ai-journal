import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import {
  PersonalityProfileDataSchema,
  filterOwnedPersonalityProfile,
  toPersonalityTraitDisplay,
  type PersonalityProfileData,
} from '../../personality-schema'
import { personalityProfileService } from '../../services/PersonalityProfileService'
import { schedulePersonalityProfileGeneration } from '../../services/schedulePersonalityProfileGeneration'

export type PersonalityEvidenceEntry = { id: string; entryDate: Date }

export type StoredPersonalityProfile = Omit<PersonalityProfileData, 'traits'> & {
  traits: (ReturnType<typeof toPersonalityTraitDisplay> & {
    evidence: PersonalityEvidenceEntry[]
  })[]
  basedOn: number
  generatedAt: Date
}

export type PersonalityProfileResponse = {
  status: 'ready' | 'updating' | 'notEnoughEntries'
  profile: StoredPersonalityProfile | null
  remainingEntries: number
  retryAfter: Date | null
  unavailable: boolean
}

type StoredRow = {
  traits: unknown
  summary: string | null
  meaning: string | null
  basedOn: number
  generatedAt: Date | null
  generatingAt: Date | null
  retryAfter: Date | null
}

function evidenceIds(profile: PersonalityProfileData): string[] {
  return [...new Set(profile.traits.flatMap((trait) => trait.evidenceEntryIds))]
}

/**
 * Validates the stored profile and keeps only evidence the user still owns. `hasRemovedEvidence`
 * flags a profile built partly from entries since deleted, so it can be regenerated without them.
 */
async function safeStoredProfile(
  userId: string,
  stored: StoredRow | null,
): Promise<{ profile: StoredPersonalityProfile | null; hasRemovedEvidence: boolean }> {
  if (!stored?.generatedAt || !stored.summary || !stored.meaning) {
    return { profile: null, hasRemovedEvidence: false }
  }
  const parsed = PersonalityProfileDataSchema.safeParse({
    traits: stored.traits,
    summary: stored.summary,
    meaning: stored.meaning,
  })
  if (!parsed.success) return { profile: null, hasRemovedEvidence: true }

  const ids = evidenceIds(parsed.data)
  const entries = await prisma.entry.findMany({
    where: { id: { in: ids }, userId, deletedAt: null, analysis: { isNot: null } },
    select: { id: true, entryDate: true },
  })
  const entryDates = new Map(entries.map(({ id, entryDate }) => [id, entryDate]))
  const hasRemovedEvidence = ids.some((entryId) => !entryDates.has(entryId))

  // Drops deleted or unowned links; a trait left with no evidence makes the profile unusable.
  const profile = filterOwnedPersonalityProfile(parsed.data, new Set(entryDates.keys()))
  if (!profile) return { profile: null, hasRemovedEvidence }

  return {
    hasRemovedEvidence,
    profile: {
      ...profile,
      traits: profile.traits.map((trait) => ({
        ...toPersonalityTraitDisplay(trait),
        evidence: trait.evidenceEntryIds.flatMap((id) => {
          const entryDate = entryDates.get(id)
          return entryDate ? [{ id, entryDate }] : []
        }),
      })),
      basedOn: stored.basedOn,
      generatedAt: stored.generatedAt,
    },
  }
}

/** Returns only a validated current profile and starts an eligible replacement after the response. */
export const personality = protectedProcedure.query(
  async ({ ctx }): Promise<PersonalityProfileResponse> => {
    const userId = ctx.user.id
    const [remainingEntries, stored] = await Promise.all([
      personalityProfileService.remainingEntries(userId),
      prisma.personalityProfile.findUnique({
        where: { userId },
        select: {
          traits: true,
          summary: true,
          meaning: true,
          basedOn: true,
          generatedAt: true,
          generatingAt: true,
          retryAfter: true,
        },
      }),
    ])
    if (remainingEntries > 0) {
      return {
        status: 'notEnoughEntries',
        profile: null,
        remainingEntries,
        retryAfter: null,
        unavailable: false,
      }
    }

    const [{ profile, hasRemovedEvidence }, aged] = await Promise.all([
      safeStoredProfile(userId, stored),
      personalityProfileService.isProfileStale(userId, stored),
    ])
    // Removed evidence forces a rebuild so a deleted entry stops shaping the reflection. The retry
    // cooldown still applies, so this cannot trigger more often than any other failed run.
    const stale = hasRemovedEvidence || aged
    const start = stale
      ? await personalityProfileService.tryStart(userId, {
          forceInvalidProfile: hasRemovedEvidence,
          preloaded: { profile: stored, stale },
        })
      : null
    if (start?.status === 'claimed') {
      schedulePersonalityProfileGeneration(userId, start.claimedAt)
    }

    const now = Date.now()
    const storedRetryAfter =
      stored?.retryAfter && stored.retryAfter.getTime() > now ? stored.retryAfter : null
    const retryAfter =
      start?.status === 'cooldown'
        ? start.retryAfter
        : start?.status === 'claimed'
          ? null
          : storedRetryAfter
    if (
      start?.status === 'claimed' ||
      start?.status === 'generation_in_progress' ||
      Boolean(stored?.generatingAt)
    ) {
      return { status: 'updating', profile, remainingEntries: 0, retryAfter, unavailable: !profile }
    }

    return {
      status: 'ready',
      profile,
      remainingEntries: 0,
      retryAfter,
      unavailable: !profile && retryAfter !== null,
    }
  },
)
