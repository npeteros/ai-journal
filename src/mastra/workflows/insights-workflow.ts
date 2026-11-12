import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  insightReportService,
  type InsightReportStatus,
} from '@/src/server/api/routers/v1/insights/services/InsightReportService'
import { USER_ID_KEY } from '../guardrails/requestContext'

export const INSIGHTS_WORKFLOW_ID = 'insights-workflow'

const outputSchema = z.object({
  status: z.enum([
    'generated',
    'insufficient_entries',
    'insufficient_evidence',
    'cooldown',
    'refresh_in_progress',
    'rate_limited',
    'timed_out',
    'failed',
  ] satisfies InsightReportStatus[]),
})

export const generateInsightReportStep = createStep({
  id: 'generate-insight-report',
  description: 'Generates and stores a user-scoped recurring themes and growth report',
  inputSchema: z.object({}),
  outputSchema,
  execute: async ({ requestContext }) => {
    const userId = requestContext.get(USER_ID_KEY)
    if (typeof userId !== 'string') {
      throw new Error('Insights workflow requires a user RequestContext')
    }
    return { status: await insightReportService.refresh(userId) }
  },
})

export const insightsWorkflow = createWorkflow({
  id: INSIGHTS_WORKFLOW_ID,
  description: 'Generates a stored recurring-themes and growth-suggestions report',
  inputSchema: z.object({}),
  outputSchema,
})
  .then(generateInsightReportStep)
  .commit()
