// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { IMastraLogger } from '@mastra/core/logger'
import { AI_USAGE_PROCESSOR_ID } from '@/src/mastra/guardrails/AiUsageProcessor'
import { TITLE_MAX_LENGTH } from '../../schema'
import { EntryTitleService, type TitleAgentCall, type TitleAgentResult } from '../EntryTitleService'

vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))

const input = {
  userId: 'user-1',
  body: 'Went for a long walk by the river this morning and felt calm for the first time in weeks.',
}
const FALLBACK = 'Went for a long walk by…'

function setup(result: TitleAgentResult | Error) {
  const callAgent = vi.fn<TitleAgentCall>(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  )
  const log = { warn: vi.fn() }
  const service = new EntryTitleService(callAgent, log as unknown as IMastraLogger)
  return { callAgent, log, service }
}

describe('EntryTitleService', () => {
  describe('generate', () => {
    it('returns the generated title', async () => {
      const { callAgent, log, service } = setup({ title: 'A Calm Riverside Walk' })

      await expect(service.generate(input)).resolves.toBe('A Calm Riverside Walk')
      expect(callAgent).toHaveBeenCalledWith(input)
      expect(log.warn).not.toHaveBeenCalled()
    })

    it('strips whitespace, wrapping quotes and a trailing period', async () => {
      const { service } = setup({ title: '  "A Calm   Riverside Walk."  ' })

      await expect(service.generate(input)).resolves.toBe('A Calm Riverside Walk')
    })

    it('caps the title at TITLE_MAX_LENGTH', async () => {
      const { service } = setup({ title: 'word '.repeat(100) })

      const title = await service.generate(input)
      expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH)
      expect(title.endsWith('…')).toBe(true)
    })

    it('falls back when the call is rate limited', async () => {
      const { log, service } = setup({
        tripwire: {
          reason: 'AI rate limit exceeded',
          processorId: AI_USAGE_PROCESSOR_ID,
          metadata: { code: 'TOO_MANY_REQUESTS' },
        },
      })

      await expect(service.generate(input)).resolves.toBe(FALLBACK)
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('blocked'),
        expect.objectContaining({ rateLimited: true }),
      )
    })

    it('falls back when another processor trips', async () => {
      const { log, service } = setup({ tripwire: { processorId: 'moderation' } })

      await expect(service.generate(input)).resolves.toBe(FALLBACK)
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('blocked'),
        expect.objectContaining({ rateLimited: false }),
      )
    })

    it('falls back when the agent throws', async () => {
      const { log, service } = setup(new Error('provider unavailable'))

      await expect(service.generate(input)).resolves.toBe(FALLBACK)
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.objectContaining({ error: 'provider unavailable' }),
      )
    })

    it.each([{}, { title: '' }, { title: '  ""  ' }])(
      'falls back when the title is empty (%o)',
      async (result) => {
        const { service } = setup(result)

        await expect(service.generate(input)).resolves.toBe(FALLBACK)
      },
    )
  })

  describe('fallbackTitle', () => {
    const { service } = setup({})

    it('uses the first six words with an ellipsis', () => {
      expect(service.fallbackTitle(input.body)).toBe(FALLBACK)
    })

    it('keeps short bodies whole', () => {
      expect(service.fallbackTitle('  Quiet   day at home ')).toBe('Quiet day at home')
    })

    it('caps a single very long word', () => {
      const title = service.fallbackTitle('a'.repeat(500))
      expect(title.length).toBe(TITLE_MAX_LENGTH)
      expect(title.endsWith('…')).toBe(true)
    })

    it('returns a placeholder for a blank body', () => {
      expect(service.fallbackTitle('   ')).toBe('Untitled entry')
    })
  })
})
