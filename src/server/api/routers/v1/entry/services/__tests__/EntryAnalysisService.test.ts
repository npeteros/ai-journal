// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { IMastraLogger } from '@mastra/core/logger'
import { AI_USAGE_PROCESSOR_ID } from '@/src/mastra/guardrails/AiUsageProcessor'
import {
  EntryAnalysisService,
  hashBody,
  type AnalysisAgentCall,
  type AnalysisAgentResult,
  type EntryAnalysisRepository,
  type EntryForAnalysis,
} from '../EntryAnalysisService'

vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))

const BODY = 'Went for a long walk by the river and felt calm for the first time in weeks.'
const NOW = new Date('2026-11-10T12:00:00.000Z')
const input = { entryId: 'entry-1', userId: 'user-1', triggerBodyHash: hashBody(BODY) }

const agentOutput = {
  mood: 'calm',
  moodScore: 140,
  summary: ['You walked by the river and felt calm.'],
  themes: ['Nature', 'rest'],
  suggestedTags: ['walks', 'river'],
}

const rateLimitTripwire = {
  reason: 'AI rate limit exceeded',
  processorId: AI_USAGE_PROCESSOR_ID,
  metadata: { code: 'TOO_MANY_REQUESTS' },
}

function setup({
  entry = { body: BODY, tagNames: ['walks'], analysisBodyHash: null },
  result = { object: agentOutput },
}: {
  entry?: EntryForAnalysis | null | Error
  result?: AnalysisAgentResult | Error
} = {}) {
  const callAgent = vi.fn<AnalysisAgentCall>(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  )
  const repository = {
    findEntry: vi.fn<EntryAnalysisRepository['findEntry']>(() =>
      entry instanceof Error ? Promise.reject(entry) : Promise.resolve(entry),
    ),
    saveAnalysis: vi.fn<EntryAnalysisRepository['saveAnalysis']>(() => Promise.resolve()),
  }
  const log = { warn: vi.fn() }
  const service = new EntryAnalysisService(
    callAgent,
    repository,
    log as unknown as IMastraLogger,
    () => NOW,
  )
  return { callAgent, repository, log, service }
}

describe('hashBody', () => {
  it('is stable and changes with the body', () => {
    expect(hashBody(BODY)).toBe(hashBody(BODY))
    expect(hashBody(BODY)).not.toBe(hashBody(`${BODY} `))
  })
})

describe('EntryAnalysisService.analyze', () => {
  it('analyzes the entry and upserts a normalized analysis', async () => {
    const { callAgent, repository, log, service } = setup()

    await expect(service.analyze(input)).resolves.toBe('analyzed')

    expect(repository.findEntry).toHaveBeenCalledWith('entry-1', 'user-1')
    expect(callAgent).toHaveBeenCalledWith({ userId: 'user-1', body: BODY, tagNames: ['walks'] })
    expect(repository.saveAnalysis).toHaveBeenCalledWith('entry-1', {
      mood: 'calm',
      moodScore: 100,
      summary: ['You walked by the river and felt calm.'],
      themes: ['nature', 'rest'],
      suggestedTags: ['river'],
      bodyHash: hashBody(BODY),
      model: 'openai/gpt-5-mini',
      analyzedAt: NOW,
    })
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('skips when the stored analysis has the same body hash', async () => {
    const { callAgent, repository, service } = setup({
      entry: { body: BODY, tagNames: [], analysisBodyHash: hashBody(BODY) },
    })

    await expect(service.analyze(input)).resolves.toBe('skipped_unchanged')
    expect(callAgent).not.toHaveBeenCalled()
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
  })

  it('re-analyzes when the stored analysis is for an older body', async () => {
    const { callAgent, service } = setup({
      entry: { body: BODY, tagNames: [], analysisBodyHash: hashBody('older body') },
    })

    await expect(service.analyze(input)).resolves.toBe('analyzed')
    expect(callAgent).toHaveBeenCalledOnce()
  })

  it('skips when the body changed after this run was triggered', async () => {
    const { callAgent, repository, service } = setup({
      entry: { body: `${BODY} And then it rained.`, tagNames: [], analysisBodyHash: null },
    })

    await expect(service.analyze(input)).resolves.toBe('skipped_stale')
    expect(callAgent).not.toHaveBeenCalled()
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
  })

  it('skips missing or soft-deleted entries', async () => {
    const { callAgent, repository, service } = setup({ entry: null })

    await expect(service.analyze(input)).resolves.toBe('skipped_missing')
    expect(callAgent).not.toHaveBeenCalled()
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
  })

  it('logs and saves nothing when the user is rate limited', async () => {
    const { repository, log, service } = setup({ result: { tripwire: rateLimitTripwire } })

    await expect(service.analyze(input)).resolves.toBe('rate_limited')
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ entryId: 'entry-1', userId: 'user-1', rateLimited: true }),
    )
  })

  it('reports other tripwires as failures', async () => {
    const { repository, service } = setup({
      result: { tripwire: { reason: 'blocked', processorId: 'other' } },
    })

    await expect(service.analyze(input)).resolves.toBe('failed')
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
  })

  it('does not throw when the agent call fails', async () => {
    const { repository, log, service } = setup({ result: new Error('provider down') })

    await expect(service.analyze(input)).resolves.toBe('failed')
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledWith(
      'Entry analysis failed',
      expect.objectContaining({ error: 'provider down' }),
    )
  })

  it('does not throw when loading or saving fails', async () => {
    await expect(setup({ entry: new Error('db down') }).service.analyze(input)).resolves.toBe(
      'failed',
    )

    const { repository, service } = setup()
    repository.saveAnalysis.mockRejectedValueOnce(new Error('write failed'))
    await expect(service.analyze(input)).resolves.toBe('failed')
  })

  it('saves nothing when the output is unusable', async () => {
    const { repository, log, service } = setup({
      result: { object: { ...agentOutput, mood: 'depressed' } },
    })

    await expect(service.analyze(input)).resolves.toBe('failed')
    expect(repository.saveAnalysis).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledWith(
      'Entry analysis returned unusable output',
      expect.any(Object),
    )
  })
})
