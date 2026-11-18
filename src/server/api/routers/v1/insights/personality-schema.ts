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
    score: z
      .number()
      .finite()
      .describe('Integer from 0 to 100, where 50 is typical. Not a 0-1 fraction or a 1-5 rating.'),
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

const FULL_ENTRY_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const PARENTHETICAL = /\s*\(([^()]*)\)/g
// An ID or ID prefix: 8+ hex characters (optionally dashed) with at least one digit, so ordinary
// words like "(defaced)" are never mistaken for one.
const ENTRY_ID_TOKEN = /^(?:entr(?:y|ies)\s+)?(?=[0-9a-f-]*\d)[0-9a-f]{8}[0-9a-f-]*$/i

function isEntryCitation(inner: string): boolean {
  const tokens = inner
    .split(/[,;]|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean)
  return tokens.length > 0 && tokens.every((token) => ENTRY_ID_TOKEN.test(token))
}

/**
 * Removes entry-ID citations the model writes into prose, such as "(361eeba9, 649bd0f4)". Evidence
 * is linked per trait in the UI, so raw IDs in the narrative are noise. Applied on read as well as
 * on generation, so profiles stored before this rule are cleaned too.
 */
export function stripEntryCitations(value: string): string {
  return value
    .replace(PARENTHETICAL, (match, inner: string) => (isEntryCitation(inner) ? '' : match))
    .replace(FULL_ENTRY_ID, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
}

const DISCLAIMER_TERM =
  /\b(?:clinical(?:ly)?|diagnos(?:e|es|is|tic|ing)|psychological assessment|assessment|scientific(?:ally)? valid\w*|medical advice)\b/i
const NEGATION =
  /\b(?:not|no|nor|never|without|isn't|aren't|doesn't|don't|cannot|can't|won't|shouldn't)\b/i

/**
 * Drops disclaimer sentences such as "These are not clinical observations." The UI shows its own
 * disclaimer, and the safety check would otherwise reject a whole run over one. Only sentences
 * with both a negation and a disclaimer term go, so a positive claim like "your entries show
 * clinical depression" survives here and is still rejected by the safety check.
 */
export function stripDisclaimers(value: string): string {
  const sentences = value.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [value]
  return sentences
    .filter((sentence) => !(DISCLAIMER_TERM.test(sentence) && NEGATION.test(sentence)))
    .join('')
}

function cleanText(value: string): string {
  return stripDisclaimers(stripEntryCitations(value)).trim().replace(/\s+/g, ' ')
}

function normalizeScore(value: number): number {
  return Math.min(PERSONALITY_SCORE_MAX, Math.max(PERSONALITY_SCORE_MIN, Math.round(value)))
}

function ownedEvidenceIds(entryIds: string[], allowedEntryIds: ReadonlySet<string>): string[] {
  return [...new Set(entryIds)].filter((entryId) => allowedEntryIds.has(entryId))
}

export type PersonalityProfileValidation =
  { profile: PersonalityProfileData; reason: null } | { profile: null; reason: string }

function rejected(reason: string): PersonalityProfileValidation {
  return { profile: null, reason }
}

/** Field paths and error codes only. Zod issues can carry the rejected value, which is journal-derived. */
function describeIssues(error: z.ZodError): string {
  const issues = error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.code}`)
  const more = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : ''
  return `${issues.join('; ')}${more}`
}

/**
 * Validates an entire Big Five profile, derives all levels from normalized scores, and removes
 * evidence IDs outside the selected user-owned source set. A profile is unusable if any trait is
 * missing, duplicated, or left without valid evidence. `reason` says which check failed, in terms
 * that are safe to log.
 */
export function validatePersonalityProfile(
  output: unknown,
  allowedEntryIds: ReadonlySet<string>,
): PersonalityProfileValidation {
  const parsed = PersonalityProfileOutputSchema.safeParse(output)
  if (!parsed.success) return rejected(`output schema: ${describeIssues(parsed.error)}`)

  // Every score at 0 or 1 means the model used a 0-1 (or similar) scale, not 0-100. Rounding that
  // would store a profile of near-zero bars, so it is rejected instead of guessed at.
  if (parsed.data.traits.every((trait) => trait.score <= 1)) {
    return rejected('scores use a 0-1 scale instead of 0-100')
  }

  const seenTraits = new Set<PersonalityTrait>()
  const traits: PersonalityProfileData['traits'] = []
  for (const rawTrait of parsed.data.traits) {
    if (seenTraits.has(rawTrait.trait)) return rejected(`duplicate trait ${rawTrait.trait}`)
    seenTraits.add(rawTrait.trait)

    const evidenceEntryIds = ownedEvidenceIds(rawTrait.evidenceEntryIds, allowedEntryIds)
    if (evidenceEntryIds.length === 0) {
      return rejected(
        `${rawTrait.trait} cites none of the supplied entries (${rawTrait.evidenceEntryIds.length} unknown IDs)`,
      )
    }

    const score = normalizeScore(rawTrait.score)
    traits.push({
      trait: rawTrait.trait,
      score,
      level: personalityLevel(score),
      evidenceEntryIds,
    })
  }

  const missing = BIG_FIVE_TRAITS.filter((trait) => !seenTraits.has(trait))
  if (missing.length > 0) return rejected(`missing traits: ${missing.join(', ')}`)

  const profile = PersonalityProfileDataSchema.safeParse({
    traits,
    summary: cleanText(parsed.data.summary),
    meaning: cleanText(parsed.data.meaning),
  })
  return profile.success
    ? { profile: profile.data, reason: null }
    : rejected(`cleaned profile schema: ${describeIssues(profile.error)}`)
}

export function filterOwnedPersonalityProfile(
  output: unknown,
  allowedEntryIds: ReadonlySet<string>,
): PersonalityProfileData | null {
  return validatePersonalityProfile(output, allowedEntryIds).profile
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
