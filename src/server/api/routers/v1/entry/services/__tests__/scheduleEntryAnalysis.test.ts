// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IMastraLogger } from '@mastra/core/logger'
import { USER_ID_KEY } from '@/src/mastra/guardrails/requestContext'
import { hashBody } from '../EntryAnalysisService'
import { scheduleEntryAnalysis } from '../scheduleEntryAnalysis'

const mocks = vi.hoisted(() => {
  const run = { start: vi.fn() }
  const workflow = { createRun: vi.fn() }
  return { run, workflow, getWorkflowById: vi.fn() }
})

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/src/mastra', () => ({ mastra: { getWorkflowById: mocks.getWorkflowById } }))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))
vi.mock('@/src/mastra/workflows/entry-analysis-workflow', () => ({
  ENTRY_ANALYSIS_WORKFLOW_ID: 'entry-analysis-workflow',
}))

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'
const input = { entryId: ENTRY_ID, userId: 'user-1', body: 'Today was calm.' }

function setup() {
  let task: (() => Promise<void>) | undefined
  const schedule = vi.fn((scheduled: () => Promise<void>) => {
    task = scheduled
  })
  const log = { warn: vi.fn() }
  scheduleEntryAnalysis(input, schedule, log as unknown as IMastraLogger)
  return { schedule, log, runTask: () => task?.() }
}

describe('scheduleEntryAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getWorkflowById.mockReturnValue(mocks.workflow)
    mocks.workflow.createRun.mockResolvedValue(mocks.run)
    mocks.run.start.mockResolvedValue({ status: 'success' })
  })

  it('defers the workflow until the scheduled task runs', () => {
    const { schedule } = setup()

    expect(schedule).toHaveBeenCalledOnce()
    expect(mocks.workflow.createRun).not.toHaveBeenCalled()
  })

  it('starts the workflow with the body hash and a user RequestContext', async () => {
    const { log, runTask } = setup()
    await runTask()

    expect(mocks.getWorkflowById).toHaveBeenCalledWith('entry-analysis-workflow')
    const [{ inputData, requestContext }] = mocks.run.start.mock.calls[0]
    expect(inputData).toEqual({ entryId: ENTRY_ID, bodyHash: hashBody(input.body) })
    expect(requestContext.get(USER_ID_KEY)).toBe('user-1')
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('logs a run that does not succeed', async () => {
    mocks.run.start.mockResolvedValue({ status: 'failed' })
    const { log, runTask } = setup()

    await expect(runTask()).resolves.toBeUndefined()
    expect(log.warn).toHaveBeenCalledWith(
      'Entry analysis workflow did not succeed',
      expect.objectContaining({ entryId: ENTRY_ID, status: 'failed' }),
    )
  })

  it('logs instead of throwing when the workflow cannot start', async () => {
    mocks.run.start.mockRejectedValue(new Error('storage down'))
    const { log, runTask } = setup()

    await expect(runTask()).resolves.toBeUndefined()
    expect(log.warn).toHaveBeenCalledWith(
      'Entry analysis workflow could not run',
      expect.objectContaining({ error: 'storage down' }),
    )
  })

  it('logs instead of throwing when scheduling fails', () => {
    const log = { warn: vi.fn() }
    const schedule = vi.fn(() => {
      throw new Error('outside request scope')
    })

    expect(() =>
      scheduleEntryAnalysis(input, schedule, log as unknown as IMastraLogger),
    ).not.toThrow()
    expect(log.warn).toHaveBeenCalledWith(
      'Entry analysis could not be scheduled',
      expect.objectContaining({ error: 'outside request scope' }),
    )
  })
})
