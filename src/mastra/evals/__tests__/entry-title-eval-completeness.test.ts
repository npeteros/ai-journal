import { describe, expect, it } from 'vitest'
import {
  assertEntryTitleEvalCompleteness,
  type EntryTitleItemScorerResults,
} from '../entry-title-eval-completeness'

const CASE_IDS = ['case-1', 'case-2', 'case-3', 'case-4', 'case-5', 'case-6']

function gateResults() {
  return [
    { id: 'entry-title-format', passed: true, score: 1 },
    { id: 'entry-title-injection', passed: true, score: 1 },
  ]
}

function caseResults(
  qualityScores: unknown[] = CASE_IDS.map(() => 1),
): EntryTitleItemScorerResults[] {
  return CASE_IDS.map((caseId, index) => ({
    caseId,
    scorerResults: {
      'entry-title-format': { score: 1 },
      'entry-title-injection': { score: 1 },
      'entry-title-quality': { score: qualityScores[index] },
    },
  }))
}

function assertComplete(itemResults = caseResults(), results: unknown = gateResults()): void {
  assertEntryTitleEvalCompleteness(itemResults, CASE_IDS, results)
}

describe('entry title evaluation completeness', () => {
  it('accepts six associated cases with separate gate and scorer results', () => {
    expect(() => assertComplete(caseResults([1, 1, 1, 1, 1, 0]))).not.toThrow()
  })

  it('associates result records by case ID rather than callback order', () => {
    expect(() => assertComplete(caseResults().reverse())).not.toThrow()
  })

  it('fails when the final quality result is missing', () => {
    const itemResults = caseResults()
    delete itemResults[5]?.scorerResults['entry-title-quality']

    expect(() => assertComplete(itemResults)).toThrow('Missing required entry-title-quality score')
  })

  it('fails when gate results are missing even if per-case scorer results are valid', () => {
    expect(() => assertComplete(caseResults(), null)).toThrow(
      'Missing required entry title gate results',
    )
  })

  it('fails duplicate and mismatched case results', () => {
    const duplicateResults = caseResults()
    duplicateResults[5] = { ...duplicateResults[5], caseId: 'case-5' }
    const mismatchedResults = caseResults()
    mismatchedResults[5] = { ...mismatchedResults[5], caseId: 'unexpected-case' }

    expect(() => assertComplete(duplicateResults)).toThrow('Duplicate entry title case result')
    expect(() => assertComplete(mismatchedResults)).toThrow('Unexpected entry title case result')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.1])(
    'fails invalid quality score %p',
    (invalidScore) => {
      const itemResults = caseResults()
      itemResults[5] = {
        ...itemResults[5],
        scorerResults: {
          ...itemResults[5]?.scorerResults,
          'entry-title-quality': { score: invalidScore },
        },
      }

      expect(() => assertComplete(itemResults)).toThrow('Invalid entry-title-quality score')
    },
  )

  it('fails not-scorable and incomplete gate results', () => {
    const notScorableResults = caseResults()
    notScorableResults[5] = {
      ...notScorableResults[5],
      scorerResults: {
        ...notScorableResults[5]?.scorerResults,
        'entry-title-quality': { notScorable: { reason: 'missing title' } },
      },
    }
    const incompleteGateResults = [{ id: 'entry-title-format', passed: true, score: 1 }]

    expect(() => assertComplete(notScorableResults)).toThrow(
      'Missing required entry-title-quality score',
    )
    expect(() => assertComplete(caseResults(), incompleteGateResults)).toThrow(
      'Missing required entry-title-injection gate result',
    )
  })

  it('fails a complete quality set below the threshold', () => {
    expect(() => assertComplete(caseResults([1, 1, 1, 1, 0, 0]))).toThrow('below 0.8')
  })

  it('keeps formatting and injection failures blocking', () => {
    const formattingFailure = caseResults()
    formattingFailure[0] = {
      ...formattingFailure[0],
      scorerResults: {
        ...formattingFailure[0]?.scorerResults,
        'entry-title-format': { score: 0 },
      },
    }
    const injectionFailure = caseResults()
    injectionFailure[1] = {
      ...injectionFailure[1],
      scorerResults: {
        ...injectionFailure[1]?.scorerResults,
        'entry-title-injection': { score: 0 },
      },
    }

    expect(() => assertComplete(formattingFailure)).toThrow('entry-title-format failed')
    expect(() => assertComplete(injectionFailure)).toThrow('entry-title-injection failed')
  })
})
