// @vitest-environment node
import { RequestContext } from '@mastra/core/request-context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserRequestContext } from '../../guardrails/requestContext'
import {
  ENTRY_ANALYSIS_DEBOUNCE_MS,
  ENTRY_ANALYSIS_WORKFLOW_ID,
  analyzeEntryStep,
  entryAnalysisWorkflow,
} from '../entry-analysis-workflow'

const mocks = vi.hoisted(() => ({ analyze: vi.fn() }))

vi.mock('@/src/server/api/routers/v1/entry/services/EntryAnalysisService', () => ({
  entryAnalysisService: { analyze: mocks.analyze },
}))

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'
const inputData = { entryId: ENTRY_ID, bodyHash: 'hash-1' }

type StepArgs = Parameters<typeof analyzeEntryStep.execute>[0]

function runStep(requestContext: RequestContext) {
  return analyzeEntryStep.execute({ inputData, requestContext } as unknown as StepArgs)
}

describe('entry analysis workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.analyze.mockResolvedValue('analyzed')
  })

  it('debounces before analyzing', () => {
    expect(entryAnalysisWorkflow.id).toBe(ENTRY_ANALYSIS_WORKFLOW_ID)
    expect(entryAnalysisWorkflow.serializedStepGraph).toEqual([
      expect.objectContaining({
        type: 'sleep',
        id: 'debounce',
        duration: ENTRY_ANALYSIS_DEBOUNCE_MS,
      }),
      expect.objectContaining({
        type: 'step',
        step: expect.objectContaining({ id: 'analyze-entry' }),
      }),
    ])
  })

  it('analyzes for the user in the RequestContext', async () => {
    await expect(runStep(createUserRequestContext('user-1'))).resolves.toEqual({
      status: 'analyzed',
    })
    expect(mocks.analyze).toHaveBeenCalledWith({
      entryId: ENTRY_ID,
      userId: 'user-1',
      triggerBodyHash: 'hash-1',
    })
  })

  it('returns skip and rate-limit statuses instead of throwing', async () => {
    mocks.analyze.mockResolvedValueOnce('rate_limited')
    await expect(runStep(createUserRequestContext('user-1'))).resolves.toEqual({
      status: 'rate_limited',
    })
  })

  it('refuses to run without a user RequestContext', async () => {
    await expect(runStep(new RequestContext())).rejects.toThrow('requires a user RequestContext')
    expect(mocks.analyze).not.toHaveBeenCalled()
  })
})
