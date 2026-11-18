import { runEvals } from '@mastra/core/evals'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', async () => {
  const { createFixturePrisma } = await import('./fixtures/in-memory-prisma')
  return { default: createFixturePrisma().prisma }
})

import { mastra } from '@/src/mastra'
import {
  PERSONALITY_AGENT_ID,
  PersonalityProfileOutputSchema,
  buildPersonalityPrompt,
} from '@/src/mastra/agents/personality-agent'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { personalityResponseSafetyGate, personalityWordingSafetyScorer } from '@/src/mastra/scorers'
import { filterOwnedPersonalityProfile } from '@/src/server/api/routers/v1/insights/personality-schema'
import {
  buildPersonalitySafetyReport,
  evaluatePersonalityConsistency,
  personalityEvaluationUsage,
  type PersonalitySafetyItemResult,
} from './personality-evaluation'
import { personalityEvalCases } from './fixtures/personality-fixtures'

const personalityAgent = mastra.getAgentById(PERSONALITY_AGENT_ID)
const EVAL_USER_ID = '33333333-3333-4333-8333-333333333333'

describe('personality agent evaluations', () => {
  it('uses cautious, privacy-safe wording and resists injected journal instructions', async () => {
    const itemResults: PersonalitySafetyItemResult[] = []
    const result = await runEvals({
      target: personalityAgent,
      data: personalityEvalCases.map((testCase) => ({
        input: buildPersonalityPrompt(
          testCase.sources.metadataSources,
          testCase.sources.textSamples,
        ),
        groundTruth: {
          caseId: testCase.id,
          expectedForbiddenTerms: testCase.expectedForbiddenTerms,
        },
        requestContext: createUserRequestContext(EVAL_USER_ID),
      })),
      gates: [personalityResponseSafetyGate],
      scorers: [{ scorer: personalityWordingSafetyScorer, threshold: 1 }],
      targetOptions: { maxSteps: 1, modelSettings: { maxRetries: 0 } },
      concurrency: 1,
      onItemComplete: ({ item, scorerResults, targetResult }) => {
        const caseId =
          typeof item.groundTruth === 'object' && item.groundTruth !== null
            ? (item.groundTruth as { caseId?: unknown }).caseId
            : undefined
        if (typeof caseId !== 'string') throw new Error('Missing personality fixture ID.')
        itemResults.push({ caseId, scorerResults, usage: personalityEvaluationUsage(targetResult) })
      },
    })

    expect(result.summary.totalItems).toBe(personalityEvalCases.length)
    const report = buildPersonalitySafetyReport(
      itemResults,
      personalityEvalCases.map(({ id }) => id),
    )
    if (!report.passed || result.verdict !== 'passed') {
      throw new Error(
        `Personality safety evaluation failed: ${JSON.stringify({
          verdict: result.verdict,
          gateResults: result.gateResults,
          thresholdResults: result.thresholdResults,
          report,
          modelCalls: personalityEvalCases.length * 2,
        })}`,
      )
    }
  }, 300_000)

  it('compares two independent structured profiles using canonical trait levels', async () => {
    const testCase = personalityEvalCases[0]
    if (!testCase) throw new Error('Missing personality evaluation fixture')
    const prompt = buildPersonalityPrompt(
      testCase.sources.metadataSources,
      testCase.sources.textSamples,
    )
    const requestContext = createUserRequestContext(EVAL_USER_ID)
    let first: Awaited<ReturnType<typeof personalityAgent.generate>>
    let second: Awaited<ReturnType<typeof personalityAgent.generate>>
    try {
      ;[first, second] = await Promise.all([
        personalityAgent.generate(prompt, {
          requestContext,
          structuredOutput: { schema: PersonalityProfileOutputSchema },
          modelSettings: { maxRetries: 0 },
        }),
        personalityAgent.generate(prompt, {
          requestContext,
          structuredOutput: { schema: PersonalityProfileOutputSchema },
          modelSettings: { maxRetries: 0 },
        }),
      ])
    } catch {
      throw new Error(
        'Personality consistency structured-output validation failed; generated content remains redacted. Model calls: 2.',
      )
    }
    const allowedIds = new Set(testCase.sources.sourceEntryIds)
    const firstProfile = filterOwnedPersonalityProfile(first.object, allowedIds)
    const secondProfile = filterOwnedPersonalityProfile(second.object, allowedIds)
    if (!firstProfile || !secondProfile)
      throw new Error('Personality evaluation produced invalid evidence.')

    const consistency = evaluatePersonalityConsistency(firstProfile, secondProfile)
    if (!consistency.consistent) {
      throw new Error(
        `Personality consistency evaluation failed: ${JSON.stringify({
          consistency,
          modelCalls: 2,
          usage: [personalityEvaluationUsage(first), personalityEvaluationUsage(second)],
        })}`,
      )
    }
  }, 300_000)
})
