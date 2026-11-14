// @vitest-environment node
import { RequestContext } from '@mastra/core/request-context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserRequestContext } from '../../guardrails/requestContext'
import {
  INSIGHTS_WORKFLOW_ID,
  generateInsightReportStep,
  insightsWorkflow,
} from '../insights-workflow'

const mocks = vi.hoisted(() => ({ generateClaimedReport: vi.fn() }))

vi.mock('@/src/server/api/routers/v1/insights/services/InsightReportService', () => ({
  insightReportService: { generateClaimedReport: mocks.generateClaimedReport },
}))

const claimedAt = new Date('2026-08-26T12:00:00.000Z')
type StepArgs = Parameters<typeof generateInsightReportStep.execute>[0]

function runStep(requestContext: RequestContext) {
  return generateInsightReportStep.execute({ inputData: { claimedAt }, requestContext } as StepArgs)
}

describe('insights workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateClaimedReport.mockResolvedValue('generated')
  })

  it('is registered as the claimed insight generation workflow', () => {
    expect(insightsWorkflow.id).toBe(INSIGHTS_WORKFLOW_ID)
  })

  it('passes the user context and exact claim timestamp to guarded generation', async () => {
    await expect(runStep(createUserRequestContext('user-1'))).resolves.toEqual({
      status: 'generated',
    })
    expect(mocks.generateClaimedReport).toHaveBeenCalledWith('user-1', claimedAt)
  })

  it('refuses to run without an authenticated user context', async () => {
    await expect(runStep(new RequestContext())).rejects.toThrow('requires a user RequestContext')
    expect(mocks.generateClaimedReport).not.toHaveBeenCalled()
  })
})
