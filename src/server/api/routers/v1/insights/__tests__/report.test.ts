// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { insightsRouter } from '../index'

const NOW = new Date('2026-08-26T12:00:00.000Z')
const ENTRY_ID = '00000000-0000-4000-8000-000000000001'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createRun: vi.fn(),
  getWorkflowById: vi.fn(),
  startWorkflow: vi.fn(),
  warn: vi.fn(),
  isStale: vi.fn(),
  remainingEntries: vi.fn(),
  tryStart: vi.fn(),
  prisma: { insightReport: { findUnique: vi.fn() } },
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/src/mastra', () => ({ mastra: { getWorkflowById: mocks.getWorkflowById } }))
vi.mock('@/src/mastra/guardrails/requestContext', () => ({
  createUserRequestContext: vi.fn((userId: string) => ({ userId })),
}))
vi.mock('@/src/mastra/observability', () => ({ logger: { warn: mocks.warn } }))
vi.mock('@/src/mastra/workflows/insights-workflow', () => ({
  INSIGHTS_WORKFLOW_ID: 'insights-workflow',
}))
vi.mock('../services/InsightReportService', () => ({
  insightReportService: {
    isStale: mocks.isStale,
    remainingEntries: mocks.remainingEntries,
    tryStart: mocks.tryStart,
  },
}))

const createCaller = createCallerFactory(insightsRouter)

function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden' },
  } as unknown as TRPCContext)
}

function savedReport(overrides: Record<string, unknown> = {}) {
  return {
    recurringThemes: [
      { title: 'Work boundaries', mentions: 1, trend: 'steady', entryIds: [ENTRY_ID] },
    ],
    growthSuggestions: [],
    trendCaption: 'A steady pattern.',
    periodStart: new Date('2026-07-28T00:00:00.000Z'),
    periodEnd: NOW,
    entryCount: 5,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    generatedAt: new Date('2026-08-20T00:00:00.000Z'),
    generatingAt: null,
    lastRefreshAt: null,
    ...overrides,
  }
}

describe('insights report API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.insightReport.findUnique.mockResolvedValue(savedReport())
    mocks.isStale.mockResolvedValue(false)
    mocks.remainingEntries.mockResolvedValue(0)
    mocks.tryStart.mockResolvedValue({ status: 'not_stale' })
    mocks.startWorkflow.mockResolvedValue({ status: 'success' })
    mocks.createRun.mockResolvedValue({ start: mocks.startWorkflow })
    mocks.getWorkflowById.mockReturnValue({ createRun: mocks.createRun })
  })

  it('returns the saved report immediately when it is ready', async () => {
    const result = await callerFor().report()

    expect(result).toMatchObject({
      status: 'ready',
      remainingEntries: 0,
      report: { recurringThemes: [expect.objectContaining({ title: 'Work boundaries' })] },
    })
    expect(mocks.tryStart).not.toHaveBeenCalled()
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('claims stale work once and responds with the previous report while it updates', async () => {
    const claimedAt = NOW
    mocks.isStale.mockResolvedValue(true)
    mocks.tryStart.mockResolvedValue({ status: 'claimed', claimedAt })
    let task: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((scheduled) => {
      task = scheduled
    })

    const result = await callerFor().report()

    expect(result).toMatchObject({ status: 'updating', report: expect.any(Object) })
    expect(mocks.tryStart).toHaveBeenCalledWith('user-1')
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.createRun).not.toHaveBeenCalled()

    await task?.()
    expect(mocks.createRun).toHaveBeenCalledWith({ resourceId: 'user-1' })
    expect(mocks.startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ inputData: { claimedAt } }),
    )
  })

  it('does not schedule duplicate work when a concurrent request loses the claim', async () => {
    mocks.isStale.mockResolvedValue(true)
    mocks.tryStart
      .mockResolvedValueOnce({ status: 'claimed', claimedAt: NOW })
      .mockResolvedValueOnce({ status: 'refresh_in_progress' })

    const first = await callerFor().report()
    const second = await callerFor().report()

    expect(first.status).toBe('updating')
    expect(second.status).toBe('updating')
    expect(mocks.after).toHaveBeenCalledOnce()
  })

  it('returns the remaining entry count without scheduling work before the first report', async () => {
    mocks.prisma.insightReport.findUnique.mockResolvedValue(null)
    mocks.remainingEntries.mockResolvedValue(2)

    await expect(callerFor().report()).resolves.toMatchObject({
      status: 'notEnoughEntries',
      report: null,
      remainingEntries: 2,
      recurringThemes: [],
      growthSuggestions: [],
    })
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('returns the manual cooldown without scheduling work', async () => {
    const nextManualRefreshAt = new Date('2026-08-27T12:00:00.000Z')
    mocks.tryStart.mockResolvedValue({ status: 'cooldown', nextManualRefreshAt })

    await expect(callerFor().refresh()).resolves.toEqual({
      status: 'cooldown',
      remainingEntries: 0,
      nextManualRefreshAt,
    })
    expect(mocks.tryStart).toHaveBeenCalledWith('user-1', { manual: true })
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('schedules a successful manual claim without awaiting generation', async () => {
    mocks.tryStart.mockResolvedValue({ status: 'claimed', claimedAt: NOW })
    let task: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((scheduled) => {
      task = scheduled
    })

    await expect(callerFor().refresh()).resolves.toEqual({
      status: 'refresh_in_progress',
      remainingEntries: 0,
      nextManualRefreshAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    })
    expect(mocks.startWorkflow).not.toHaveBeenCalled()

    await task?.()
    expect(mocks.startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ inputData: { claimedAt: NOW } }),
    )
  })

  it('never rejects the response when background generation fails', async () => {
    mocks.isStale.mockResolvedValue(true)
    mocks.tryStart.mockResolvedValue({ status: 'claimed', claimedAt: NOW })
    mocks.startWorkflow.mockRejectedValue(new Error('provider unavailable'))
    let task: (() => Promise<void>) | undefined
    mocks.after.mockImplementation((scheduled) => {
      task = scheduled
    })

    await expect(callerFor().report()).resolves.toMatchObject({ status: 'updating' })
    await expect(task?.()).resolves.toBeUndefined()
    expect(mocks.warn).toHaveBeenCalledWith(
      'Insight report background generation could not run',
      expect.objectContaining({ userId: 'user-1', error: 'provider unavailable' }),
    )
  })
})
