import { z } from 'zod'

export const BIG_FIVE_TRAITS = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
] as const

export const PersonalityTraitSchema = z.enum(BIG_FIVE_TRAITS)
export type PersonalityTrait = z.infer<typeof PersonalityTraitSchema>

export const PERSONALITY_SCORE_MIN = 0
export const PERSONALITY_SCORE_MAX = 100
export const PERSONALITY_SUMMARY_MAX_LENGTH = 280
export const PERSONALITY_MEANING_MAX_LENGTH = 1_200
export const PERSONALITY_TRAIT_MAX_EVIDENCE_ENTRIES = 20

// Generation timing lives here (not in the service) so the client can bound polling by it.
export const PERSONALITY_PROFILE_LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const PERSONALITY_PROFILE_LOCK_SAFETY_MS = 2 * 60 * 1000
export const PERSONALITY_PROFILE_GENERATION_TIMEOUT_MS =
  PERSONALITY_PROFILE_LOCK_TIMEOUT_MS - PERSONALITY_PROFILE_LOCK_SAFETY_MS

export const PersonalityLevelSchema = z.enum(['Low', 'Moderate', 'High'])
export type PersonalityLevel = z.infer<typeof PersonalityLevelSchema>

const PersonalityOutputTraitSchema = z
  .object({
    trait: PersonalityTraitSchema,
    score: z.number().finite(),
    // The model may provide a level for schema compatibility, but persistence always derives it.
    level: PersonalityLevelSchema.optional(),
    evidenceEntryIds: z.array(z.uuid()).min(1).max(PERSONALITY_TRAIT_MAX_EVIDENCE_ENTRIES),
  })
  .strict()

/** Provider-facing schema. Scores and levels are normalized server-side before persistence. */
export const PersonalityProfileOutputSchema = z
  .object({
    traits: z.array(PersonalityOutputTraitSchema).length(BIG_FIVE_TRAITS.length),
    summary: z.string().trim().min(1).max(PERSONALITY_SUMMARY_MAX_LENGTH),
    meaning: z.string().trim().min(1).max(PERSONALITY_MEANING_MAX_LENGTH),
  })
  .strict()

const StoredPersonalityTraitSchema = z.object({
  trait: PersonalityTraitSchema,
  score: z.int().min(PERSONALITY_SCORE_MIN).max(PERSONALITY_SCORE_MAX),
  level: PersonalityLevelSchema,
  evidenceEntryIds: z.array(z.uuid()).min(1).max(PERSONALITY_TRAIT_MAX_EVIDENCE_ENTRIES),
})

export const PersonalityProfileDataSchema = z.object({
  traits: z.array(StoredPersonalityTraitSchema).length(BIG_FIVE_TRAITS.length),
  summary: z.string().min(1).max(PERSONALITY_SUMMARY_MAX_LENGTH),
  meaning: z.string().min(1).max(PERSONALITY_MEANING_MAX_LENGTH),
})

export type PersonalityProfileData = z.infer<typeof PersonalityProfileDataSchema>

export function personalityLevel(score: number): PersonalityLevel {
  if (score <= 33) return 'Low'
  if (score <= 66) return 'Moderate'
  return 'High'
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeScore(value: number): number {
  return Math.min(PERSONALITY_SCORE_MAX, Math.max(PERSONALITY_SCORE_MIN, Math.round(value)))
}

function ownedEvidenceIds(entryIds: string[], allowedEntryIds: ReadonlySet<string>): string[] {
  return [...new Set(entryIds)].filter((entryId) => allowedEntryIds.has(entryId))
}

/**
 * Validates an entire Big Five profile, derives all levels from normalized scores, and removes
 * evidence IDs outside the selected user-owned source set. A profile is unusable if any trait is
 * missing, duplicated, or left without valid evidence.
 */
export function filterOwnedPersonalityProfile(
  output: unknown,
  allowedEntryIds: ReadonlySet<string>,
): PersonalityProfileData | null {
  const parsed = PersonalityProfileOutputSchema.safeParse(output)
  if (!parsed.success) return null

  const seenTraits = new Set<PersonalityTrait>()
  const traits: PersonalityProfileData['traits'] = []
  for (const rawTrait of parsed.data.traits) {
    if (seenTraits.has(rawTrait.trait)) return null
    seenTraits.add(rawTrait.trait)

    const evidenceEntryIds = ownedEvidenceIds(rawTrait.evidenceEntryIds, allowedEntryIds)
    if (evidenceEntryIds.length === 0) return null

    const score = normalizeScore(rawTrait.score)
    traits.push({
      trait: rawTrait.trait,
      score,
      level: personalityLevel(score),
      evidenceEntryIds,
    })
  }

  if (BIG_FIVE_TRAITS.some((trait) => !seenTraits.has(trait))) return null

  const profile = PersonalityProfileDataSchema.safeParse({
    traits,
    summary: cleanText(parsed.data.summary),
    meaning: cleanText(parsed.data.meaning),
  })
  return profile.success ? profile.data : null
}

export type PersonalityTraitDisplay = {
  trait: PersonalityTrait
  label: string
  score: number
  level: PersonalityLevel
}

const DISPLAY_LABELS: Record<PersonalityTrait, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Emotional stability',
}

/** The UI presents Emotional stability as the explicit inverse of the canonical Neuroticism score. */
export function toPersonalityTraitDisplay(
  trait: PersonalityProfileData['traits'][number],
): PersonalityTraitDisplay {
  const score = trait.trait === 'neuroticism' ? PERSONALITY_SCORE_MAX - trait.score : trait.score
  return {
    trait: trait.trait,
    label: DISPLAY_LABELS[trait.trait],
    score,
    level: personalityLevel(score),
  }
}
