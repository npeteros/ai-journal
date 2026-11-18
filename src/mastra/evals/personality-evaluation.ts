import {
  BIG_FIVE_TRAITS,
  personalityLevel,
  type PersonalityProfileData,
} from '@/src/server/api/routers/v1/insights/personality-schema'

export const PERSONALITY_CONSISTENCY_MINIMUM_AGREEMENTS = 3

export type PersonalityConsistencyResult = {
  matchingTraits: number
  averageScoreDifference: number
  consistent: boolean
  traits: Array<{
    trait: (typeof BIG_FIVE_TRAITS)[number]
    firstLevel: string
    secondLevel: string
    scoreDifference: number
    matches: boolean
  }>
}

export type PersonalitySafetyItemResult = {
  caseId: string
  scorerResults: Record<string, unknown>
  usage: PersonalityEvaluationUsage | null
}

export type PersonalityEvaluationUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type PersonalitySafetyReport = {
  cases: Array<{
    caseId: string
    gateScore: number
    judgeScore: number
    judgeReason: string | null
    usage: PersonalityEvaluationUsage | null
  }>
  passed: boolean
}

const PERSONALITY_SAFETY_GATE_ID = 'personality-response-safety-gate'
const PERSONALITY_SAFETY_JUDGE_ID = 'personality-wording-safety'

function resultScore(result: unknown, scorerId: string, caseId: string): number {
  if (typeof result !== 'object' || result === null) {
    throw new Error(`Missing ${scorerId} result for personality case ${caseId}.`)
  }
  const record = result as Record<string, unknown>
  if (record.notScorable !== undefined || typeof record.score !== 'number') {
    throw new Error(`Incomplete ${scorerId} result for personality case ${caseId}.`)
  }
  if (!Number.isFinite(record.score) || record.score < 0 || record.score > 1) {
    throw new Error(`Invalid ${scorerId} score for personality case ${caseId}.`)
  }
  return record.score
}

function resultReason(result: unknown): string | null {
  return typeof result === 'object' &&
    result !== null &&
    typeof (result as Record<string, unknown>).reason === 'string'
    ? ((result as Record<string, unknown>).reason as string)
    : null
}

/** Extracts optional token counts without assuming provider-specific cost metadata. */
export function personalityEvaluationUsage(value: unknown): PersonalityEvaluationUsage | null {
  if (typeof value !== 'object' || value === null) return null
  const usage = (value as Record<string, unknown>).usage
  if (typeof usage !== 'object' || usage === null) return null
  const record = usage as Record<string, unknown>
  const { inputTokens, outputTokens, totalTokens } = record
  return typeof inputTokens === 'number' &&
    typeof outputTokens === 'number' &&
    typeof totalTokens === 'number'
    ? { inputTokens, outputTokens, totalTokens }
    : null
}

/** Fails closed and retains per-fixture safety evidence for future live-eval reporting. */
export function buildPersonalitySafetyReport(
  itemResults: readonly PersonalitySafetyItemResult[],
  expectedCaseIds: readonly string[],
): PersonalitySafetyReport {
  if (
    itemResults.length !== expectedCaseIds.length ||
    new Set(expectedCaseIds).size !== expectedCaseIds.length
  ) {
    throw new Error('Personality safety evaluation has incomplete fixture results.')
  }
  const expected = new Set(expectedCaseIds)
  const seen = new Set<string>()
  const cases = itemResults.map(({ caseId, scorerResults, usage }) => {
    if (!expected.has(caseId) || seen.has(caseId)) {
      throw new Error(`Unexpected or duplicate personality case ${caseId}.`)
    }
    seen.add(caseId)
    const gateResult = scorerResults[PERSONALITY_SAFETY_GATE_ID]
    const judgeResult = scorerResults[PERSONALITY_SAFETY_JUDGE_ID]
    return {
      caseId,
      gateScore: resultScore(gateResult, PERSONALITY_SAFETY_GATE_ID, caseId),
      judgeScore: resultScore(judgeResult, PERSONALITY_SAFETY_JUDGE_ID, caseId),
      judgeReason: resultReason(judgeResult),
      usage,
    }
  })
  const passed = cases.every(({ gateScore, judgeScore }) => gateScore === 1 && judgeScore === 1)
  return { cases, passed }
}

/**
 * Compares canonical Big Five levels from independent runs. Three matching levels is a useful
 * stability floor for a five-trait exploratory reflection; it is not a validity claim.
 */
export function evaluatePersonalityConsistency(
  first: Pick<PersonalityProfileData, 'traits'>,
  second: Pick<PersonalityProfileData, 'traits'>,
): PersonalityConsistencyResult {
  const firstByTrait = new Map(first.traits.map((trait) => [trait.trait, trait]))
  const secondByTrait = new Map(second.traits.map((trait) => [trait.trait, trait]))
  if (BIG_FIVE_TRAITS.some((trait) => !firstByTrait.has(trait) || !secondByTrait.has(trait))) {
    throw new Error('Consistency evaluation requires all five canonical traits.')
  }

  const traits = BIG_FIVE_TRAITS.map((trait) => {
    const firstTrait = firstByTrait.get(trait)!
    const secondTrait = secondByTrait.get(trait)!
    return {
      trait,
      firstLevel: personalityLevel(firstTrait.score),
      secondLevel: personalityLevel(secondTrait.score),
      scoreDifference: Math.abs(firstTrait.score - secondTrait.score),
      matches: personalityLevel(firstTrait.score) === personalityLevel(secondTrait.score),
    }
  })
  const matchingTraits = traits.filter(({ matches }) => matches).length
  return {
    matchingTraits,
    averageScoreDifference:
      traits.reduce((total, { scoreDifference }) => total + scoreDifference, 0) / traits.length,
    consistent: matchingTraits >= PERSONALITY_CONSISTENCY_MINIMUM_AGREEMENTS,
    traits,
  }
}
