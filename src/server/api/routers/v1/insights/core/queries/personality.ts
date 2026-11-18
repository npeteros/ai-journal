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

export type PersonalityEvidenceEntry = { id: string; title: string; entryDate: Date }

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
 * Validates the stored profile and keeps only evidence the user still owns. `needsRebuild` flags a
 * stored profile that is invalid, or was built partly from entries since deleted, so it is
 * regenerated without waiting for the normal staleness rule.
 */
async function safeStoredProfile(
  userId: string,
  stored: StoredRow | null,
): Promise<{ profile: StoredPersonalityProfile | null; needsRebuild: boolean }> {
  if (!stored?.generatedAt) return { profile: null, needsRebuild: false }
  if (!stored.summary || !stored.meaning) return { profile: null, needsRebuild: true }
  const parsed = PersonalityProfileDataSchema.safeParse({
    traits: stored.traits,
    summary: stored.summary,
    meaning: stored.meaning,
  })
  if (!parsed.success) return { profile: null, needsRebuild: true }

  const ids = evidenceIds(parsed.data)
  const entries = await prisma.entry.findMany({
    where: { id: { in: ids }, userId, deletedAt: null, analysis: { isNot: null } },
    select: { id: true, title: true, entryDate: true },
  })
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
  const hasRemovedEvidence = ids.some((entryId) => !entriesById.has(entryId))

  // Drops deleted or unowned links; a trait left with no evidence makes the profile unusable.
  const profile = filterOwnedPersonalityProfile(parsed.data, new Set(entriesById.keys()))
  if (!profile) return { profile: null, needsRebuild: true }

  return {
    needsRebuild: hasRemovedEvidence,
    profile: {
      ...profile,
      traits: profile.traits.map((trait) => ({
        ...toPersonalityTraitDisplay(trait),
        evidence: trait.evidenceEntryIds.flatMap((id) => {
          const entry = entriesById.get(id)
          return entry ? [entry] : []
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

    const [{ profile, needsRebuild }, aged] = await Promise.all([
      safeStoredProfile(userId, stored),
      personalityProfileService.isProfileStale(userId, stored),
    ])
    // An invalid profile, or one shaped by a since-deleted entry, is rebuilt now. The retry cooldown
    // still applies, so this cannot trigger more often than any other failed run.
    const stale = needsRebuild || aged
    const start = stale
      ? await personalityProfileService.tryStart(userId, {
          forceInvalidProfile: needsRebuild,
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
