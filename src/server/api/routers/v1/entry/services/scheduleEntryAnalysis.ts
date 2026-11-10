import { after } from 'next/server'
import type { IMastraLogger } from '@mastra/core/logger'
import { mastra } from '@/src/mastra'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { ENTRY_ANALYSIS_WORKFLOW_ID } from '@/src/mastra/workflows/entry-analysis-workflow'
import { hashBody } from './EntryAnalysisService'

export type ScheduleEntryAnalysisInput = {
  entryId: string
  /** From the authenticated session, never from client input. */
  userId: string
  body: string
}

type Schedule = (task: () => Promise<void>) => void

async function runEntryAnalysisWorkflow(
  { entryId, userId, body }: ScheduleEntryAnalysisInput,
  log: IMastraLogger,
) {
  try {
    const run = await mastra.getWorkflowById(ENTRY_ANALYSIS_WORKFLOW_ID).createRun()
    // Awaited (not startAsync) so `after()` keeps the function alive through the debounce
    // sleep and the model call on serverless hosts.
    const result = await run.start({
      inputData: { entryId, bodyHash: hashBody(body) },
      requestContext: createUserRequestContext(userId),
    })
    if (result.status !== 'success') {
      log.warn('Entry analysis workflow did not succeed', {
        entryId,
        userId,
        status: result.status,
      })
    }
  } catch (error) {
    log.warn('Entry analysis workflow could not run', {
      entryId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Starts entry analysis after the response is sent. Never throws and never delays the
 * mutation: the workflow debounces, skips stale or unchanged bodies, and logs failures.
 */
export function scheduleEntryAnalysis(
  input: ScheduleEntryAnalysisInput,
  schedule: Schedule = after,
  log: IMastraLogger = logger,
): void {
  try {
    schedule(() => runEntryAnalysisWorkflow(input, log))
  } catch (error) {
    // e.g. `after()` called outside a request scope.
    log.warn('Entry analysis could not be scheduled', {
      entryId: input.entryId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
