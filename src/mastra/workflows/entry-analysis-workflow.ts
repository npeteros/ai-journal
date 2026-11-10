import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { entryAnalysisService } from '@/src/server/api/routers/v1/entry/services/EntryAnalysisService'
import { USER_ID_KEY } from '../guardrails/requestContext'

export const ENTRY_ANALYSIS_WORKFLOW_ID = 'entry-analysis-workflow'

/** Wait this long after a save before analyzing, so editor autosaves collapse into one call. */
export const ENTRY_ANALYSIS_DEBOUNCE_MS = 30_000

const inputSchema = z.object({
  entryId: z.uuid(),
  /** Hash of the body at trigger time; the run skips itself if the body changed since. */
  bodyHash: z.string(),
})

const outputSchema = z.object({
  status: z.enum([
    'analyzed',
    'skipped_missing',
    'skipped_stale',
    'skipped_unchanged',
    'rate_limited',
    'failed',
  ]),
})

export const analyzeEntryStep = createStep({
  id: 'analyze-entry',
  description: 'Analyzes the entry and upserts EntryAnalysis, unless it changed or is unchanged',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, requestContext }) => {
    // The user comes from the server-built RequestContext, never from workflow input.
    const userId = requestContext.get(USER_ID_KEY)
    if (typeof userId !== 'string') {
      throw new Error('Entry analysis workflow requires a user RequestContext')
    }

    // Rate limits and failures are logged by the service and returned as a status rather than
    // thrown: the entry just has no analysis yet, and there is no caller waiting on the run.
    const status = await entryAnalysisService.analyze({
      entryId: inputData.entryId,
      userId,
      triggerBodyHash: inputData.bodyHash,
    })
    return { status }
  },
})

export const entryAnalysisWorkflow = createWorkflow({
  id: ENTRY_ANALYSIS_WORKFLOW_ID,
  description: 'Debounces, then analyzes a journal entry and stores its mood, summary and themes',
  inputSchema,
  outputSchema,
})
  .sleep(ENTRY_ANALYSIS_DEBOUNCE_MS, { id: 'debounce' })
  .then(analyzeEntryStep)
  .commit()
