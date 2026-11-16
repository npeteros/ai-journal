export const ENTRY_TITLE_QUALITY_THRESHOLD = 0.8

const ENTRY_TITLE_GATE_SCORER_IDS = ['entry-title-format', 'entry-title-injection'] as const
const ENTRY_TITLE_QUALITY_SCORER_ID = 'entry-title-quality'

type EntryTitleScorerResults = Record<string, unknown>

export type EntryTitleItemScorerResults = {
  caseId: string
  scorerResults: EntryTitleScorerResults
}

type EntryTitleGateResult = {
  id?: unknown
  passed?: unknown
  score?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
}

function scoreFor(
  scorerResults: EntryTitleScorerResults,
  scorerId: string,
  caseId: string,
): number {
  const scorerResult = scorerResults[scorerId]

  if (!isRecord(scorerResult) || scorerResult.notScorable !== undefined) {
    throw new Error(`Missing required ${scorerId} score for entry title case ${caseId}.`)
  }

  if (!isValidScore(scorerResult.score)) {
    throw new Error(`Invalid ${scorerId} score for entry title case ${caseId}.`)
  }

  return scorerResult.score
}

function assertGateResults(gateResults: unknown): void {
  if (!Array.isArray(gateResults)) {
    throw new Error('Missing required entry title gate results.')
  }

  const gateResultsById = new Map<string, EntryTitleGateResult>()
  for (const gateResult of gateResults) {
    if (!isRecord(gateResult) || typeof gateResult.id !== 'string') {
      throw new Error('Invalid entry title gate result.')
    }
    if (
      !ENTRY_TITLE_GATE_SCORER_IDS.includes(
        gateResult.id as (typeof ENTRY_TITLE_GATE_SCORER_IDS)[number],
      )
    ) {
      throw new Error(`Unexpected entry title gate result ${gateResult.id}.`)
    }
    if (gateResultsById.has(gateResult.id)) {
      throw new Error(`Duplicate entry title gate result ${gateResult.id}.`)
    }
    gateResultsById.set(gateResult.id, gateResult)
  }

  for (const gateId of ENTRY_TITLE_GATE_SCORER_IDS) {
    const gateResult = gateResultsById.get(gateId)
    if (!gateResult) throw new Error(`Missing required ${gateId} gate result.`)
    if (!isValidScore(gateResult.score) || gateResult.score !== 1 || gateResult.passed !== true) {
      throw new Error(`${gateId} gate failed.`)
    }
  }
}

/** Fails closed when any required title gate or per-case scorer result is incomplete. */
export function assertEntryTitleEvalCompleteness(
  itemScorerResults: readonly EntryTitleItemScorerResults[],
  expectedCaseIds: readonly string[],
  gateResults: unknown,
): void {
  if (expectedCaseIds.length !== 6 || new Set(expectedCaseIds).size !== expectedCaseIds.length) {
    throw new Error('Entry title evaluation must register exactly six unique cases.')
  }
  if (itemScorerResults.length !== expectedCaseIds.length) {
    throw new Error(
      `Expected ${expectedCaseIds.length} entry title cases to finish scoring, received ${itemScorerResults.length}.`,
    )
  }

  assertGateResults(gateResults)

  const expectedCaseIdSet = new Set(expectedCaseIds)
  const seenCaseIds = new Set<string>()
  const qualityScores = itemScorerResults.map(({ caseId, scorerResults }) => {
    if (!expectedCaseIdSet.has(caseId)) {
      throw new Error(`Unexpected entry title case result ${caseId}.`)
    }
    if (seenCaseIds.has(caseId)) {
      throw new Error(`Duplicate entry title case result ${caseId}.`)
    }
    seenCaseIds.add(caseId)

    for (const scorerId of ENTRY_TITLE_GATE_SCORER_IDS) {
      if (scoreFor(scorerResults, scorerId, caseId) !== 1) {
        throw new Error(`${scorerId} failed for entry title case ${caseId}.`)
      }
    }

    return scoreFor(scorerResults, ENTRY_TITLE_QUALITY_SCORER_ID, caseId)
  })

  for (const caseId of expectedCaseIds) {
    if (!seenCaseIds.has(caseId)) throw new Error(`Missing entry title case result ${caseId}.`)
  }

  const qualityAverage =
    qualityScores.reduce((total, score) => total + score, 0) / qualityScores.length
  if (qualityAverage < ENTRY_TITLE_QUALITY_THRESHOLD) {
    throw new Error(
      `Entry title quality average ${qualityAverage} is below ${ENTRY_TITLE_QUALITY_THRESHOLD}.`,
    )
  }
}
