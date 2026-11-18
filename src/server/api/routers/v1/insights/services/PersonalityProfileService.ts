import type { IMastraLogger } from '@mastra/core/logger'
import { isMastraTimeoutError } from '@mastra/core/loop'
import prisma from '@/src/lib/prisma'
import { logger } from '@/src/mastra/observability'
import { filterOwnedPersonalityProfile, type PersonalityProfileData } from '../personality-schema'

export const PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES = 20
export const PERSONALITY_PROFILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const PERSONALITY_PROFILE_MIN_NEW_ENTRIES = 10
export const PERSONALITY_PROFILE_LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const PERSONALITY_PROFILE_LOCK_SAFETY_MS = 2 * 60 * 1000
export const PERSONALITY_PROFILE_GENERATION_TIMEOUT_MS =
  PERSONALITY_PROFILE_LOCK_TIMEOUT_MS - PERSONALITY_PROFILE_LOCK_SAFETY_MS
/** Applied when a failed run has no more specific provider or rate-limit reset deadline. */
export const PERSONALITY_PROFILE_FAILURE_COOLDOWN_MS = 5 * 60 * 1000
export const PERSONALITY_PROFILE_MAX_METADATA_SOURCES = 100
export const PERSONALITY_PROFILE_MAX_TEXT_SAMPLES = 20
export const PERSONALITY_PROFILE_MAX_TEXT_SAMPLE_CHARACTERS = 1_200
export const PERSONALITY_PROFILE_MAX_TOTAL_TEXT_CHARACTERS = 24_000

export type PersonalityProfileStatus =
  | 'generated'
  | 'insufficient_entries'
  | 'insufficient_evidence'
  | 'rate_limited'
  | 'timed_out'
  | 'failed'

export type PersonalityProfileState = {
  generatedAt: Date | null
  generatingAt: Date | null
  retryAfter: Date | null
}

export type PersonalityProfileRecord = PersonalityProfileData & {
  basedOn: number
  model: string
  generatedAt: Date
}

export type PersonalitySourceCandidate = {
  id: string
  userId: string
  entryDate: Date
  analyzedAt: Date
  summary: string[]
  themes: string[]
  body: string
  deletedAt: Date | null
}

export type PersonalityMetadataSource = {
  id: string
  date: string
  summary: string[]
  themes: string[]
}

export type PersonalityTextSample = {
  id: string
  date: string
  text: string
}

export type PersonalitySources = {
  metadataSources: PersonalityMetadataSource[]
  textSamples: PersonalityTextSample[]
  sourceEntryIds: string[]
}

export type PersonalityProfileRepository = {
  findProfile(userId: string): Promise<PersonalityProfileState | null>
  countAnalyzedEntries(userId: string, analyzedSince?: Date): Promise<number>
  ensureProfile(userId: string): Promise<void>
  claimGeneration(input: {
    userId: string
    claimedAt: Date
    lockExpiresBefore: Date
  }): Promise<boolean>
  activateGeneration(userId: string, claimedAt: Date, executionAt: Date): Promise<boolean>
  loadSources(userId: string): Promise<PersonalitySourceCandidate[]>
  filterEligibleSourceIds(userId: string, sourceEntryIds: string[]): Promise<string[]>
  saveProfile(
    userId: string,
    executionAt: Date,
    profile: PersonalityProfileRecord,
  ): Promise<boolean>
  failGeneration(userId: string, executionAt: Date, retryAfter: Date | null): Promise<void>
  failClaim(userId: string, claimedAt: Date, retryAfter: Date): Promise<void>
}

export type PersonalityProfileStartResult =
  | { status: 'claimed'; claimedAt: Date }
  | { status: 'not_enough_entries'; missingEntries: number }
  | { status: 'cooldown'; retryAfter: Date }
  | { status: 'not_stale' | 'generation_in_progress' }

/** Adapter for a future workflow. It is injected so this phase cannot invoke a live model. */
export type PersonalityProfileGenerator = (input: {
  userId: string
  metadataSources: PersonalityMetadataSource[]
  textSamples: PersonalityTextSample[]
}) => Promise<{ output?: unknown; rateLimited?: boolean; retryAfter?: Date }>

function sourceDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function compareSources(
  left: PersonalitySourceCandidate,
  right: PersonalitySourceCandidate,
): number {
  return left.entryDate.getTime() - right.entryDate.getTime() || left.id.localeCompare(right.id)
}

function cooldownAfter(now: Date, requested?: Date): Date {
  return requested && requested.getTime() > now.getTime()
    ? requested
    : new Date(now.getTime() + PERSONALITY_PROFILE_FAILURE_COOLDOWN_MS)
}

const UNSAFE_PERSONALITY_NARRATIVE =
  /\b(?:diagnos(?:e|is|tic)|mental[- ]health disorder|anxiety disorder|depression|clinical|psychological assessment|scientific(?:ally)? valid|superior|inferior|better trait|worse trait)\b/i

function normalizedNarrative(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Rejects prohibited claims and lengthy source excerpts before they can be stored or displayed. */
function isSafePersonalityNarrative(
  profile: PersonalityProfileData,
  textSamples: PersonalityTextSample[],
): boolean {
  const narrative = `${profile.summary} ${profile.meaning}`
  if (UNSAFE_PERSONALITY_NARRATIVE.test(narrative)) return false
  const normalized = normalizedNarrative(narrative)
  return !textSamples.some((sample) => {
    const source = normalizedNarrative(sample.text)
    return source.length >= 48 && normalized.includes(source)
  })
}

/**
 * Keeps the most recent eligible metadata entries in chronological order. Text samples are a
 * smaller, bounded subset of those same entries, so `basedOn` exactly reflects prompt evidence.
 */
export function selectPersonalitySources(
  candidates: PersonalitySourceCandidate[],
  userId: string,
): PersonalitySources {
  const metadataCandidates = candidates
    .filter((candidate) => candidate.userId === userId && candidate.deletedAt === null)
    .sort(compareSources)
    .slice(-PERSONALITY_PROFILE_MAX_METADATA_SOURCES)

  const metadataSources = metadataCandidates.map(({ id, entryDate, summary, themes }) => ({
    id,
    date: sourceDate(entryDate),
    summary,
    themes,
  }))

  let remainingTextCharacters = PERSONALITY_PROFILE_MAX_TOTAL_TEXT_CHARACTERS
  const textSamples = metadataCandidates
    .slice(-PERSONALITY_PROFILE_MAX_TEXT_SAMPLES)
    .flatMap(({ id, entryDate, body }) => {
      const text = body.slice(
        0,
        Math.min(PERSONALITY_PROFILE_MAX_TEXT_SAMPLE_CHARACTERS, remainingTextCharacters),
      )
      remainingTextCharacters -= text.length
      return text ? [{ id, date: sourceDate(entryDate), text }] : []
    })

  return {
    metadataSources,
    textSamples,
    sourceEntryIds: metadataSources.map(({ id }) => id),
  }
}

export const prismaPersonalityProfileRepository: PersonalityProfileRepository = {
  async findProfile(userId) {
    return prisma.personalityProfile.findUnique({
      where: { userId },
      select: { generatedAt: true, generatingAt: true, retryAfter: true },
    })
  },

  async countAnalyzedEntries(userId, analyzedSince) {
    return prisma.entry.count({
      where: {
        userId,
        deletedAt: null,
        analysis: analyzedSince ? { is: { analyzedAt: { gt: analyzedSince } } } : { isNot: null },
      },
    })
  },

  async ensureProfile(userId) {
    await prisma.personalityProfile.upsert({ where: { userId }, create: { userId }, update: {} })
  },

  async claimGeneration({ userId, claimedAt, lockExpiresBefore }) {
    const claimed = await prisma.personalityProfile.updateMany({
      where: {
        userId,
        AND: [
          { OR: [{ generatingAt: null }, { generatingAt: { lt: lockExpiresBefore } }] },
          { OR: [{ retryAfter: null }, { retryAfter: { lte: claimedAt } }] },
        ],
      },
      data: { generatingAt: claimedAt },
    })
    return claimed.count === 1
  },

  async activateGeneration(userId, claimedAt, executionAt) {
    const activated = await prisma.personalityProfile.updateMany({
      where: { userId, generatingAt: claimedAt },
      data: { generatingAt: executionAt },
    })
    return activated.count === 1
  },

  async loadSources(userId) {
    const entries = await prisma.entry.findMany({
      where: { userId, deletedAt: null, analysis: { isNot: null } },
      select: {
        id: true,
        userId: true,
        entryDate: true,
        body: true,
        deletedAt: true,
        analysis: { select: { analyzedAt: true, summary: true, themes: true } },
      },
      orderBy: [{ entryDate: 'desc' }, { id: 'desc' }],
      take: PERSONALITY_PROFILE_MAX_METADATA_SOURCES,
    })

    return entries.flatMap((entry) =>
      entry.analysis
        ? [
            {
              id: entry.id,
              userId: entry.userId,
              entryDate: entry.entryDate,
              analyzedAt: entry.analysis.analyzedAt,
              summary: entry.analysis.summary,
              themes: entry.analysis.themes,
              body: entry.body,
              deletedAt: entry.deletedAt,
            },
          ]
        : [],
    )
  },

  async filterEligibleSourceIds(userId, sourceEntryIds) {
    const entries = await prisma.entry.findMany({
      where: {
        id: { in: sourceEntryIds },
        userId,
        deletedAt: null,
        analysis: { isNot: null },
      },
      select: { id: true },
    })
    return entries.map(({ id }) => id)
  },

  async saveProfile(userId, executionAt, profile) {
    const saved = await prisma.personalityProfile.updateMany({
      // A worker that lost its stale lock cannot overwrite a newer profile.
      where: { userId, generatingAt: executionAt },
      data: {
        traits: profile.traits,
        summary: profile.summary,
        meaning: profile.meaning,
        basedOn: profile.basedOn,
        model: profile.model,
        generatedAt: profile.generatedAt,
        generatingAt: null,
        retryAfter: null,
      },
    })
    return saved.count === 1
  },

  async failGeneration(userId, executionAt, retryAfter) {
    await prisma.personalityProfile.updateMany({
      where: { userId, generatingAt: executionAt },
      data: { generatingAt: null, retryAfter },
    })
  },

  async failClaim(userId, claimedAt, retryAfter) {
    await prisma.personalityProfile.updateMany({
      where: { userId, generatingAt: claimedAt },
      data: { generatingAt: null, retryAfter },
    })
  },
}

/** Stores a single user-scoped Big Five profile without coupling lifecycle code to a model agent. */
export class PersonalityProfileService {
  constructor(
    private readonly repository: PersonalityProfileRepository = prismaPersonalityProfileRepository,
    private readonly log: IMastraLogger = logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async remainingEntries(userId: string): Promise<number> {
    const count = await this.repository.countAnalyzedEntries(userId)
    return Math.max(0, PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES - count)
  }

  async isStale(userId: string): Promise<boolean> {
    if ((await this.remainingEntries(userId)) > 0) return false

    const profile = await this.repository.findProfile(userId)
    if (!profile?.generatedAt) return true
    if (profile.generatedAt.getTime() > this.now().getTime() - PERSONALITY_PROFILE_MAX_AGE_MS) {
      return false
    }
    return (
      (await this.repository.countAnalyzedEntries(userId, profile.generatedAt)) >=
      PERSONALITY_PROFILE_MIN_NEW_ENTRIES
    )
  }

  async tryStart(
    userId: string,
    options: { forceInvalidProfile?: boolean } = {},
  ): Promise<PersonalityProfileStartResult> {
    const now = this.now()
    const missingEntries = await this.remainingEntries(userId)
    if (missingEntries > 0) return { status: 'not_enough_entries', missingEntries }

    const profile = await this.repository.findProfile(userId)
    if (profile?.retryAfter && profile.retryAfter.getTime() > now.getTime()) {
      return { status: 'cooldown', retryAfter: profile.retryAfter }
    }

    if (!options.forceInvalidProfile && !(await this.isStale(userId))) {
      return { status: 'not_stale' }
    }

    const claimedAt = now
    await this.repository.ensureProfile(userId)
    const claimed = await this.repository.claimGeneration({
      userId,
      claimedAt,
      lockExpiresBefore: new Date(claimedAt.getTime() - PERSONALITY_PROFILE_LOCK_TIMEOUT_MS),
    })
    if (claimed) return { status: 'claimed', claimedAt }

    const current = await this.repository.findProfile(userId)
    if (current?.retryAfter && current.retryAfter.getTime() > now.getTime()) {
      return { status: 'cooldown', retryAfter: current.retryAfter }
    }
    return { status: 'generation_in_progress' }
  }

  /** Releases a scheduled-but-unstarted claim with a durable, claim-fenced failure cooldown. */
  async failClaim(userId: string, claimedAt: Date): Promise<void> {
    await this.repository.failClaim(userId, claimedAt, cooldownAfter(this.now()))
  }

  async generateClaimedProfile(
    userId: string,
    claimedAt: Date,
    model: string,
    generate: PersonalityProfileGenerator,
  ): Promise<PersonalityProfileStatus> {
    const claimed = await this.repository.findProfile(userId)
    const now = this.now()
    if (
      !claimed?.generatingAt ||
      claimed.generatingAt.getTime() !== claimedAt.getTime() ||
      claimedAt.getTime() < now.getTime() - PERSONALITY_PROFILE_LOCK_TIMEOUT_MS
    ) {
      this.log.warn('Personality profile generation skipped without an active claim', { userId })
      return 'failed'
    }

    const executionAt = new Date(Math.max(now.getTime(), claimedAt.getTime() + 1))
    try {
      if (!(await this.repository.activateGeneration(userId, claimedAt, executionAt))) {
        this.log.warn('Personality profile generation skipped because its claim is executing', {
          userId,
        })
        return 'failed'
      }

      if ((await this.remainingEntries(userId)) > 0) {
        await this.repository.failGeneration(userId, executionAt, null)
        return 'insufficient_entries'
      }

      const sources = selectPersonalitySources(await this.repository.loadSources(userId), userId)
      if (sources.sourceEntryIds.length < PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES) {
        await this.repository.failGeneration(userId, executionAt, null)
        return 'insufficient_entries'
      }

      const result = await generate({
        userId,
        metadataSources: sources.metadataSources,
        textSamples: sources.textSamples,
      })
      if (result.rateLimited) {
        await this.repository.failGeneration(
          userId,
          executionAt,
          cooldownAfter(this.now(), result.retryAfter),
        )
        return 'rate_limited'
      }

      // Reject if a source was deleted while the model ran; it may have influenced the output.
      const eligibleSourceIds = await this.repository.filterEligibleSourceIds(
        userId,
        sources.sourceEntryIds,
      )
      const eligibleSourceIdSet = new Set(eligibleSourceIds)
      if (sources.sourceEntryIds.some((entryId) => !eligibleSourceIdSet.has(entryId))) {
        await this.repository.failGeneration(userId, executionAt, cooldownAfter(this.now()))
        return 'insufficient_evidence'
      }

      const profile = filterOwnedPersonalityProfile(result.output, eligibleSourceIdSet)
      if (!profile || !isSafePersonalityNarrative(profile, sources.textSamples)) {
        await this.repository.failGeneration(userId, executionAt, cooldownAfter(this.now()))
        return 'insufficient_evidence'
      }

      const saved = await this.repository.saveProfile(userId, executionAt, {
        ...profile,
        basedOn: sources.sourceEntryIds.length,
        model,
        generatedAt: claimedAt,
      })
      if (!saved) {
        this.log.warn('Personality profile claim was replaced before persistence', { userId })
        return 'failed'
      }
      return 'generated'
    } catch (error) {
      this.log.warn('Personality profile generation failed', {
        userId,
      })
      try {
        await this.repository.failGeneration(userId, executionAt, cooldownAfter(this.now()))
      } catch {
        this.log.warn('Personality profile generation cleanup failed', {
          userId,
        })
      }
      return isMastraTimeoutError(error) ? 'timed_out' : 'failed'
    }
  }
}

export const personalityProfileService = new PersonalityProfileService()
