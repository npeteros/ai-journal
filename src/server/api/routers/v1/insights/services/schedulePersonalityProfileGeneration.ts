import { after } from 'next/server'
import type { IMastraLogger } from '@mastra/core/logger'
import { mastra } from '@/src/mastra'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { PERSONALITY_WORKFLOW_ID } from '@/src/mastra/workflows/personality-workflow'
import { personalityProfileService } from './PersonalityProfileService'

type Schedule = (task: () => Promise<void>) => void
type RunWorkflow = (userId: string, claimedAt: Date, log: IMastraLogger) => Promise<void>
type FailClaim = (userId: string, claimedAt: Date) => Promise<void>

async function runClaimedPersonalityWorkflow(
  userId: string,
  claimedAt: Date,
  log: IMastraLogger,
  failClaim: FailClaim = personalityProfileService.failClaim.bind(personalityProfileService),
) {
  try {
    const run = await mastra
      .getWorkflowById<'personalityWorkflow'>(PERSONALITY_WORKFLOW_ID)
      .createRun({ resourceId: userId })
    const result = await run.start({
      inputData: { claimedAt },
      requestContext: createUserRequestContext(userId),
    })
    if (result.status !== 'success') {
      await failClaim(userId, claimedAt)
      log.warn('Personality profile workflow did not succeed', { userId, status: result.status })
    }
  } catch {
    try {
      await failClaim(userId, claimedAt)
    } catch {
      log.warn('Personality profile background cleanup could not run', { userId })
    }
    log.warn('Personality profile background generation could not run', { userId })
  }
}

/**
 * Schedules an already-claimed run after the response. The three-minute agent deadline remains
 * inside the five-minute stale-lock lease, leaving two minutes for stale-lock recovery.
 */
export function schedulePersonalityProfileGeneration(
  userId: string,
  claimedAt: Date,
  schedule: Schedule = after,
  runWorkflow: RunWorkflow = runClaimedPersonalityWorkflow,
  failClaim: FailClaim = personalityProfileService.failClaim.bind(personalityProfileService),
  log: IMastraLogger = logger,
): void {
  try {
    schedule(() => runWorkflow(userId, claimedAt, log))
  } catch {
    void failClaim(userId, claimedAt).catch(() => {
      log.warn('Personality profile scheduling cleanup could not run', { userId })
    })
    log.warn('Personality profile generation could not be scheduled', { userId })
  }
}
