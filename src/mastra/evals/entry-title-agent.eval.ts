import { runEvals } from '@mastra/core/evals'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', async () => {
  const { createFixturePrisma } = await import('./fixtures/in-memory-prisma')
  return { default: createFixturePrisma().prisma }
})

import { mastra } from '@/src/mastra'
import { ENTRY_TITLE_AGENT_ID } from '@/src/mastra/agents/entry-title-agent'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import {
  entryTitleFormatScorer,
  entryTitleInjectionScorer,
  entryTitleQualityScorer,
} from '@/src/mastra/scorers'
import {
  assertEntryTitleEvalCompleteness,
  ENTRY_TITLE_QUALITY_THRESHOLD,
  type EntryTitleItemScorerResults,
} from './entry-title-eval-completeness'
import { EVAL_USER_A_ID, entryTitleEvalCases } from './fixtures/journal-fixtures'

const titleAgent = mastra.getAgentById(ENTRY_TITLE_AGENT_ID)

describe('entry title agent evaluations', () => {
  it('writes concise, safe, relevant titles for normal, minimal, long, multilingual, and injection-bearing entries', async () => {
    // Format and injection resistance are hard gates. The subjective relevance, language, and
    // tone judge has a minimum 0.8 threshold and never compares generated titles exactly.
    const itemScorerResults: EntryTitleItemScorerResults[] = []
    const result = await runEvals({
      target: titleAgent,
      data: entryTitleEvalCases.map(({ body, id }) => ({
        input: body,
        groundTruth: { caseId: id },
        requestContext: createUserRequestContext(EVAL_USER_A_ID),
      })),
      gates: [entryTitleFormatScorer, entryTitleInjectionScorer],
      // Mastra only exposes top-level gates as run-level aggregates. These duplicate,
      // deterministic scorer entries provide per-case gate evidence without model calls.
      scorers: [
        entryTitleFormatScorer,
        entryTitleInjectionScorer,
        { scorer: entryTitleQualityScorer, threshold: ENTRY_TITLE_QUALITY_THRESHOLD },
      ],
      targetOptions: { maxSteps: 1 },
      concurrency: 1,
      onItemComplete: ({ item, scorerResults }) => {
        const caseId =
          typeof item.groundTruth === 'object' && item.groundTruth !== null
            ? (item.groundTruth as { caseId?: unknown }).caseId
            : undefined
        if (typeof caseId !== 'string') throw new Error('Missing entry title evaluation case ID.')
        itemScorerResults.push({ caseId, scorerResults })
      },
    })

    expect(result.summary.totalItems).toBe(entryTitleEvalCases.length)
    expect(result.summary.notScorable).toBeUndefined()
    expect(() => {
      assertEntryTitleEvalCompleteness(
        itemScorerResults,
        entryTitleEvalCases.map(({ id }) => id),
        result.gateResults,
      )
    }).not.toThrow()
    expect(result.verdict).toBe('passed')
  }, 300_000)
})
