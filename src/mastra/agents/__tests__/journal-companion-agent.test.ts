// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AI_USAGE_PROCESSOR_ID } from '../../guardrails/AiUsageProcessor'
import { JOURNAL_COMPANION_AGENT_ID, journalCompanionAgent } from '../journal-companion-agent'

describe('journal companion agent', () => {
  it('registers Jaden with journal tools, memory, and both AI usage processors', async () => {
    expect(journalCompanionAgent.id).toBe(JOURNAL_COMPANION_AGENT_ID)
    expect(journalCompanionAgent.name).toBe('Jaden')
    expect(journalCompanionAgent.hasOwnMemory()).toBe(true)
    expect(Object.keys(await journalCompanionAgent.listTools())).toEqual([
      'searchEntriesTool',
      'getEntryTool',
    ])
    expect(
      (await journalCompanionAgent.listConfiguredInputProcessors()).map(({ id }) => id),
    ).toEqual([AI_USAGE_PROCESSOR_ID])
    expect(
      (await journalCompanionAgent.listConfiguredOutputProcessors()).map(({ id }) => id),
    ).toEqual([AI_USAGE_PROCESSOR_ID])
  })
})
