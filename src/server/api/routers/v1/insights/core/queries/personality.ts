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

export type StoredPersonalityProfile = Omit<PersonalityProfileData, 'traits'> & {
  traits: (ReturnType<typeof toPersonalityTraitDisplay> & { evidenceEntryIds: string[] })[]
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

function evidenceIds(profile: PersonalityProfileData): string[] {
  return [...new Set(profile.traits.flatMap((trait) => trait.evidenceEntryIds))]
}

async function safeStoredProfile(
  userId: string,
  stored: {
    traits: unknown
    summary: string | null
    meaning: string | null
    basedOn: number
    generatedAt: Date | null
  } | null,
): Promise<StoredPersonalityProfile | null> {
  if (!stored?.generatedAt || !stored.summary || !stored.meaning) return null
  const parsed = PersonalityProfileDataSchema.safeParse({
    traits: stored.traits,
    summary: stored.summary,
    meaning: stored.meaning,
  })
  if (!parsed.success) return null

  const ids = evidenceIds(parsed.data)
  const entries = await prisma.entry.findMany({
    where: { id: { in: ids }, userId, deletedAt: null, analysis: { isNot: null } },
    select: { id: true },
  })
  const eligibleIds = new Set(entries.map(({ id }) => id))
  // A deleted or unowned reference invalidates the whole sensitive profile, not just its link.
  if (ids.some((entryId) => !eligibleIds.has(entryId))) return null

  const profile = filterOwnedPersonalityProfile(parsed.data, eligibleIds)
  return profile
    ? {
        ...profile,
        traits: profile.traits.map((trait) => ({
          ...toPersonalityTraitDisplay(trait),
          evidenceEntryIds: trait.evidenceEntryIds,
        })),
        basedOn: stored.basedOn,
        generatedAt: stored.generatedAt,
      }
    : null
}

/** Returns only a validated current profile and starts an eligible replacement after the response. */
export const personality = protectedProcedure.query(
  async ({ ctx }): Promise<PersonalityProfileResponse> => {
    const remainingEntries = await personalityProfileService.remainingEntries(ctx.user.id)
    if (remainingEntries > 0) {
      return {
        status: 'notEnoughEntries',
        profile: null,
        remainingEntries,
        retryAfter: null,
        unavailable: false,
      }
    }

    const stored = await prisma.personalityProfile.findUnique({
      where: { userId: ctx.user.id },
      select: {
        traits: true,
        summary: true,
        meaning: true,
        basedOn: true,
        generatedAt: true,
        generatingAt: true,
        retryAfter: true,
      },
    })
    const profile = await safeStoredProfile(ctx.user.id, stored)
    const invalidProfile = Boolean(stored?.generatedAt && !profile)
    const stale = invalidProfile || (await personalityProfileService.isStale(ctx.user.id))
    const start = stale
      ? await personalityProfileService.tryStart(ctx.user.id, {
          forceInvalidProfile: invalidProfile,
        })
      : null
    if (start?.status === 'claimed') {
      schedulePersonalityProfileGeneration(ctx.user.id, start.claimedAt)
    }

    const retryAfter =
      start?.status === 'cooldown' ? start.retryAfter : (stored?.retryAfter ?? null)
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
