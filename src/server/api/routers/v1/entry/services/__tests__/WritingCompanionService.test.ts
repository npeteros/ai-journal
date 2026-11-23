// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IMastraLogger } from '@mastra/core/logger'
import { COMPANION_COOLDOWN_MS, COMPANION_MAX_PER_ENTRY } from '@/src/lib/companion'
import { AI_USAGE_PROCESSOR_ID } from '@/src/mastra/guardrails/AiUsageProcessor'
import {
  WritingCompanionService,
  type CompanionAgentCall,
  type CompanionAgentResult,
} from '../WritingCompanionService'

vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))

const NOW = new Date('2026-11-23T10:00:00.000Z')
const fiftyWords = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ')
const input = { userId: 'user-1', entryId: 'entry-1', text: fiftyWords, trigger: 'auto' as const }

type PriorRow = { createdAt: Date; wordCount: number; question: string | null }

function setup({
  result = { question: 'What made that moment stand out?' },
  prior = [],
  entry = { title: 'Morning', tags: [{ tag: { name: 'work' } }] },
}: {
  result?: CompanionAgentResult | Error
  prior?: PriorRow[]
  entry?: { title: string; tags: { tag: { name: string } }[] } | null
} = {}) {
  const tx = {
    $executeRaw: vi.fn(() => Promise.resolve(1)),
    entry: { findFirst: vi.fn(() => Promise.resolve(entry)) },
    writingCompanionQuestion: {
      findMany: vi.fn(() => Promise.resolve(prior)),
      create: vi.fn(() => Promise.resolve({ id: 'question-1' })),
    },
  }
  const db = {
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    writingCompanionQuestion: { update: vi.fn(() => Promise.resolve({ createdAt: NOW })) },
  }
  const callAgent = vi.fn<CompanionAgentCall>(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  )
  const log = { warn: vi.fn(), error: vi.fn() }
  const service = new WritingCompanionService(
    callAgent,
    db as unknown as ConstructorParameters<typeof WritingCompanionService>[1],
    log as unknown as IMastraLogger,
    () => NOW,
  )
  return { tx, db, callAgent, log, service }
}

describe('WritingCompanionService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a question and records it apart from the entry', async () => {
    const { tx, db, callAgent, service } = setup({
      prior: [
        {
          createdAt: new Date(NOW.getTime() - 10 * 60_000),
          wordCount: 5,
          question: 'What was on your mind?',
        },
      ],
    })

    await expect(service.ask(input)).resolves.toEqual({
      status: 'ok',
      question: 'What made that moment stand out?',
      remaining: COMPANION_MAX_PER_ENTRY - 2,
      retryAt: new Date(NOW.getTime() + COMPANION_COOLDOWN_MS).toISOString(),
    })

    expect(tx.$executeRaw).toHaveBeenCalled()
    expect(tx.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'entry-1', userId: 'user-1', deletedAt: null } }),
    )
    expect(tx.writingCompanionQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { entryId: 'entry-1', userId: 'user-1', wordCount: 50, status: 'pending' },
      }),
    )
    expect(callAgent).toHaveBeenCalledWith({
      userId: 'user-1',
      prompt: {
        title: 'Morning',
        tags: ['work'],
        body: fiftyWords,
        previousQuestions: ['What was on your mind?'],
      },
    })
    expect(db.writingCompanionQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'question-1' },
        data: { status: 'answered', question: 'What made that moment stand out?' },
      }),
    )
  })

  it('leaves failed attempts out of the per-entry rules', async () => {
    const { tx, service } = setup()

    await service.ask(input)

    expect(tx.writingCompanionQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entryId: 'entry-1', status: { not: 'failed' } } }),
    )
  })

  it('refuses a request inside the cooldown without calling the model', async () => {
    const createdAt = new Date(NOW.getTime() - 1000)
    const { tx, callAgent, service } = setup({
      prior: [{ createdAt, wordCount: 0, question: 'Earlier?' }],
    })

    await expect(service.ask({ ...input, trigger: 'manual' })).resolves.toEqual({
      status: 'blocked',
      reason: 'cooldown',
      retryAt: new Date(createdAt.getTime() + COMPANION_COOLDOWN_MS).toISOString(),
    })
    expect(callAgent).not.toHaveBeenCalled()
    expect(tx.writingCompanionQuestion.create).not.toHaveBeenCalled()
  })

  it('refuses an automatic request without enough new words', async () => {
    const { callAgent, service } = setup()

    await expect(service.ask({ ...input, text: 'just a few words' })).resolves.toEqual({
      status: 'blocked',
      reason: 'not_enough_text',
    })
    expect(callAgent).not.toHaveBeenCalled()
  })

  it('refuses once the entry has had its questions', async () => {
    const prior = Array.from({ length: COMPANION_MAX_PER_ENTRY }, (_, i) => ({
      createdAt: new Date(NOW.getTime() - (i + 2) * COMPANION_COOLDOWN_MS),
      wordCount: 0,
      question: `Question ${i}?`,
    }))
    const { callAgent, service } = setup({ prior })

    await expect(service.ask({ ...input, trigger: 'manual' })).resolves.toEqual({
      status: 'blocked',
      reason: 'entry_cap',
    })
    expect(callAgent).not.toHaveBeenCalled()
  })

  it("throws NOT_FOUND for an entry that isn't the user's", async () => {
    const { callAgent, service } = setup({ entry: null })

    await expect(service.ask(input)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(callAgent).not.toHaveBeenCalled()
  })

  it('reports an over-limit call as limited and frees the slot', async () => {
    const { db, service } = setup({
      result: {
        tripwire: {
          processorId: AI_USAGE_PROCESSOR_ID,
          reason: 'Writing companion limit exceeded',
          metadata: { code: 'TOO_MANY_REQUESTS' },
        },
      },
    })

    await expect(service.ask(input)).resolves.toEqual({ status: 'limited' })
    expect(db.writingCompanionQuestion.update).toHaveBeenCalledWith({
      where: { id: 'question-1' },
      data: { status: 'failed' },
    })
  })

  it.each<[string, CompanionAgentResult | Error]>([
    ['another tripwire', { tripwire: { processorId: 'moderation' } }],
    ['an empty question', { question: '   ' }],
    ['a model error', new Error('timeout')],
  ])('reports %s as unavailable and frees the slot', async (_, result) => {
    const { db, log, service } = setup({ result })

    await expect(service.ask(input)).resolves.toEqual({ status: 'unavailable' })
    expect(db.writingCompanionQuestion.update).toHaveBeenCalledWith({
      where: { id: 'question-1' },
      data: { status: 'failed' },
    })
    expect(log.warn).toHaveBeenCalled()
  })

  it('still answers when marking a failed attempt fails', async () => {
    const { db, log, service } = setup({ result: new Error('timeout') })
    db.writingCompanionQuestion.update.mockRejectedValueOnce(new Error('db down'))

    await expect(service.ask(input)).resolves.toEqual({ status: 'unavailable' })
    expect(log.error).toHaveBeenCalled()
  })
})
