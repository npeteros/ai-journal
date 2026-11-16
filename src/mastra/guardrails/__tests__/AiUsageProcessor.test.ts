// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { RequestContext } from '@mastra/core/request-context'
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
} from '@mastra/core/processors'
import {
  AI_USAGE_PROCESSOR_ID,
  AiUsageProcessor,
  assertNotRateLimited,
  isAiRateLimited,
} from '../AiUsageProcessor'
import type { AiUsageService } from '../AiUsageService'
import { createUserRequestContext } from '../requestContext'

// Keep the real Prisma client and Mastra observability out of unit tests.
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('../../observability', () => ({ logger: {} }))

const NOW = new Date('2026-11-02T12:00:00.000Z')

// Processor args are large framework objects; tests only fill in the fields the processor reads.
function asArgs<T>(partial: Partial<T>): T {
  return partial as unknown as T
}

class TripWireError extends Error {
  constructor(
    reason: string,
    readonly options: unknown,
  ) {
    super(reason)
  }
}

function setup() {
  const service = {
    reserve: vi.fn().mockResolvedValue('usage-1'),
    finalize: vi.fn().mockResolvedValue(undefined),
  }
  const processor = new AiUsageProcessor(service as unknown as AiUsageService)
  const agent = {
    id: 'journal-companion-agent',
    getModel: vi.fn().mockResolvedValue({ provider: 'openai', modelId: 'gpt-5-mini' }),
  }
  const abort = vi.fn((reason?: string, options?: unknown) => {
    throw new TripWireError(reason ?? '', options)
  })
  const state: Record<string, unknown> = {}
  const messages: never[] = []

  const input = (requestContext: RequestContext = createUserRequestContext('user-1')) =>
    processor.processInput(
      asArgs<ProcessInputArgs<{ code: 'TOO_MANY_REQUESTS' }>>({
        agent: agent as unknown as ProcessInputArgs['agent'],
        requestContext,
        state,
        abort: abort as unknown as ProcessInputArgs['abort'],
        messages,
      }),
    )

  const inputStep = (provider: string, modelId: string) =>
    processor.processInputStep(
      asArgs<ProcessInputStepArgs<{ code: 'TOO_MANY_REQUESTS' }>>({
        model: { provider, modelId } as unknown as ProcessInputStepArgs['model'],
        state,
      }),
    )

  const outputStep = (inputTokens: number, outputTokens: number) =>
    processor.processOutputStep(
      asArgs<ProcessOutputStepArgs<{ code: 'TOO_MANY_REQUESTS' }>>({
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        state,
        messages,
      }),
    )

  const outputResult = (
    finishReason: string,
    usage: { inputTokens?: number; outputTokens?: number } = {},
    resultState: Record<string, unknown> = state,
  ) =>
    processor.processOutputResult(
      asArgs<ProcessOutputResultArgs<{ code: 'TOO_MANY_REQUESTS' }>>({
        result: {
          text: '',
          finishReason,
          steps: [],
          usage: { totalTokens: undefined, ...usage },
        } as unknown as ProcessOutputResultArgs['result'],
        state: resultState,
        messages,
      }),
    )

  return { service, agent, abort, input, inputStep, outputStep, outputResult }
}

describe('AiUsageProcessor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('processInput', () => {
    it('reserves a row for the user in the RequestContext, before the model is called', async () => {
      const { service, input } = setup()

      await input()

      expect(service.reserve).toHaveBeenCalledWith({
        userId: 'user-1',
        agent: 'journal-companion-agent',
        model: 'openai/gpt-5-mini',
      })
    })

    it('reserves a system row (userId null) when called with no user, e.g. from a workflow', async () => {
      const { service, input } = setup()

      await input(new RequestContext())

      expect(service.reserve).toHaveBeenCalledWith(expect.objectContaining({ userId: null }))
    })

    it('aborts with a rate-limit tripwire when the user is over the limit', async () => {
      const { service, abort, input } = setup()
      service.reserve.mockRejectedValue(
        new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'AI rate limit exceeded' }),
      )

      await expect(input()).rejects.toBeInstanceOf(TripWireError)
      expect(abort).toHaveBeenCalledWith('AI rate limit exceeded', {
        metadata: { code: 'TOO_MANY_REQUESTS' },
      })
    })

    it('rethrows other reservation errors without aborting', async () => {
      const { service, abort, input } = setup()
      const error = new Error('connection refused')
      service.reserve.mockRejectedValue(error)

      await expect(input()).rejects.toBe(error)
      expect(abort).not.toHaveBeenCalled()
    })
  })

  describe('processOutputResult', () => {
    it('finalizes once with the model used, total tokens, latency and success', async () => {
      const { service, input, inputStep, outputStep, outputResult } = setup()

      await input()
      inputStep('anthropic', 'claude-haiku-5-5')
      outputStep(100, 20)
      outputStep(150, 30)
      vi.advanceTimersByTime(800)
      await outputResult('stop', { inputTokens: 250, outputTokens: 50 })

      expect(service.finalize).toHaveBeenCalledExactlyOnceWith('usage-1', {
        model: 'anthropic/claude-haiku-5-5',
        inputTokens: 250,
        outputTokens: 50,
        latencyMs: 800,
        success: true,
      })
    })

    it.each(['error', 'aborted'])(
      'records a failed call with the step totals when the run ends with %s',
      async (finishReason) => {
        const { service, input, outputStep, outputResult } = setup()

        await input()
        outputStep(100, 20)
        outputStep(40, 0)
        await outputResult(finishReason)

        expect(service.finalize).toHaveBeenCalledWith(
          'usage-1',
          expect.objectContaining({ inputTokens: 140, outputTokens: 20, success: false }),
        )
      },
    )

    it('does nothing when this request never reserved a row', async () => {
      const { service, outputResult } = setup()

      await outputResult('stop', {}, {})

      expect(service.finalize).not.toHaveBeenCalled()
    })

    it('does not finalize the same run twice', async () => {
      const { service, input, outputResult } = setup()

      await input()
      await outputResult('stop')
      await outputResult('stop')

      expect(service.finalize).toHaveBeenCalledOnce()
    })
  })
})

describe('isAiRateLimited', () => {
  it('matches a rate-limit tripwire from this processor', () => {
    expect(
      isAiRateLimited({
        processorId: AI_USAGE_PROCESSOR_ID,
        metadata: { code: 'TOO_MANY_REQUESTS' },
      }),
    ).toBe(true)
  })

  it.each([
    ['no tripwire', undefined],
    ['another processor', { processorId: 'moderation', metadata: { code: 'TOO_MANY_REQUESTS' } }],
    ['no metadata', { processorId: AI_USAGE_PROCESSOR_ID }],
  ])('ignores %s', (_label, tripwire) => {
    expect(isAiRateLimited(tripwire)).toBe(false)
  })
})

describe('assertNotRateLimited', () => {
  it('throws TOO_MANY_REQUESTS for a rate-limited result', () => {
    const result = {
      tripwire: {
        reason: 'AI rate limit exceeded',
        processorId: AI_USAGE_PROCESSOR_ID,
        metadata: { code: 'TOO_MANY_REQUESTS' },
      },
    }

    expect(() => assertNotRateLimited(result)).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
    )
  })

  it('passes results without a tripwire', () => {
    expect(() => assertNotRateLimited({})).not.toThrow()
  })
})
