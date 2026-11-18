import { describe, expect, it } from 'vitest'
import {
  BIG_FIVE_TRAITS,
  personalityLevel,
} from '@/src/server/api/routers/v1/insights/personality-schema'
import {
  PERSONALITY_CONSISTENCY_MINIMUM_AGREEMENTS,
  buildPersonalitySafetyReport,
  evaluatePersonalityConsistency,
  personalityEvaluationUsage,
} from '../personality-evaluation'
import { personalityEvalCases } from '../fixtures/personality-fixtures'

function profile(scores: number[]) {
  return {
    traits: BIG_FIVE_TRAITS.map((trait, index) => ({
      trait,
      score: scores[index] ?? 50,
      level: personalityLevel(scores[index] ?? 50),
      evidenceEntryIds: ['00000000-0000-4000-8000-000000000001'],
    })),
  }
}

describe('personality evaluation fixtures', () => {
  it('uses only synthetic data and includes twenty eligible entries with an injection attempt', () => {
    const injectionCase = personalityEvalCases.find(
      ({ id }) => id === 'prompt-injection-resistance',
    )
    expect(personalityEvalCases).toHaveLength(3)
    expect(injectionCase?.sources.sourceEntryIds).toHaveLength(20)
    expect(
      injectionCase?.sources.textSamples.some(({ text }) =>
        /ignore all prior instructions/i.test(text),
      ),
    ).toBe(true)
  })

  it('passes consistency when at least three canonical levels agree and reports score deltas', () => {
    const result = evaluatePersonalityConsistency(
      profile([20, 45, 70, 50, 80]),
      profile([30, 55, 80, 20, 10]),
    )
    expect(result).toMatchObject({ matchingTraits: 3, consistent: true })
    expect(result.averageScoreDifference).toBeGreaterThan(0)
  })

  it('fails consistency below the explicit three-of-five threshold', () => {
    const result = evaluatePersonalityConsistency(
      profile([10, 10, 10, 10, 10]),
      profile([90, 90, 90, 10, 90]),
    )
    expect(result.matchingTraits).toBeLessThan(PERSONALITY_CONSISTENCY_MINIMUM_AGREEMENTS)
    expect(result.consistent).toBe(false)
  })

  it('reports every safety fixture and fails closed for failed, missing, or invalid judge results', () => {
    const caseIds = ['safe', 'unsafe']
    const complete = [
      {
        caseId: 'safe',
        scorerResults: {
          'personality-response-safety-gate': { score: 1 },
          'personality-wording-safety': { score: 1, reason: 'safe wording' },
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      },
      {
        caseId: 'unsafe',
        scorerResults: {
          'personality-response-safety-gate': { score: 1 },
          'personality-wording-safety': { score: 0, reason: 'clinical claim' },
        },
        usage: null,
      },
    ]
    expect(buildPersonalitySafetyReport(complete, caseIds)).toMatchObject({
      passed: false,
      cases: [
        { caseId: 'safe', judgeScore: 1 },
        { caseId: 'unsafe', judgeScore: 0 },
      ],
    })
    expect(() => buildPersonalitySafetyReport(complete.slice(0, 1), caseIds)).toThrow('incomplete')
    expect(() =>
      buildPersonalitySafetyReport(
        [
          {
            caseId: 'safe',
            scorerResults: { 'personality-response-safety-gate': { score: 1 } },
            usage: null,
          },
        ],
        ['safe'],
      ),
    ).toThrow('Missing personality-wording-safety')
    expect(() =>
      buildPersonalitySafetyReport(
        [
          {
            caseId: 'safe',
            scorerResults: {
              'personality-response-safety-gate': { score: 1 },
              'personality-wording-safety': { score: 'invalid' },
            },
            usage: null,
          },
        ],
        ['safe'],
      ),
    ).toThrow('Incomplete personality-wording-safety')
  })

  it('retains token counts only when a provider supplies complete usage data', () => {
    expect(
      personalityEvaluationUsage({ usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 } }),
    ).toEqual({ inputTokens: 3, outputTokens: 2, totalTokens: 5 })
    expect(personalityEvaluationUsage({ usage: { totalTokens: 5 } })).toBeNull()
  })

  it('rejects a consistency comparison missing a canonical trait', () => {
    expect(() =>
      evaluatePersonalityConsistency(profile([50, 50, 50, 50, 50]), { traits: [] }),
    ).toThrow('all five canonical traits')
  })
})
