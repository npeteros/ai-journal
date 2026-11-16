import { after } from 'next/server'
import type { IMastraLogger } from '@mastra/core/logger'
import { mastra } from '@/src/mastra'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { INSIGHTS_WORKFLOW_ID } from '@/src/mastra/workflows/insights-workflow'

type Schedule = (task: () => Promise<void>) => void
type RunWorkflow = (userId: string, claimedAt: Date, log: IMastraLogger) => Promise<void>

async function runClaimedInsightWorkflow(userId: string, claimedAt: Date, log: IMastraLogger) {
  try {
    const run = await mastra
      .getWorkflowById<'insightsWorkflow'>(INSIGHTS_WORKFLOW_ID)
      .createRun({ resourceId: userId })
    const result = await run.start({
      inputData: { claimedAt },
      requestContext: createUserRequestContext(userId),
    })
    if (result.status !== 'success') {
      log.warn('Insight report workflow did not succeed', { userId, status: result.status })
    }
  } catch (error) {
    log.warn('Insight report background generation could not run', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Schedules claimed generation after the response and isolates callers from background failures. */
export function scheduleInsightReportGeneration(
  userId: string,
  claimedAt: Date,
  schedule: Schedule = after,
  runWorkflow: RunWorkflow = runClaimedInsightWorkflow,
  log: IMastraLogger = logger,
): void {
  try {
    schedule(() => runWorkflow(userId, claimedAt, log))
  } catch (error) {
    log.warn('Insight report generation could not be scheduled', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
