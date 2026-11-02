// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AI_USAGE_PROCESSOR_ID } from '../AiUsageProcessor'
import { peekRateLimit } from '../chatStream'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('../../observability', () => ({ logger: {} }))

type Chunk = { type: string; [key: string]: unknown }

function streamOf(chunks: Chunk[]): ReadableStream<Chunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function readAll(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

describe('peekRateLimit', () => {
  it('reports a rate-limit tripwire', async () => {
    const result = await peekRateLimit(
      streamOf([
        { type: 'start' },
        {
          type: 'data-tripwire',
          data: {
            reason: 'AI rate limit exceeded',
            processorId: AI_USAGE_PROCESSOR_ID,
            metadata: { code: 'TOO_MANY_REQUESTS' },
          },
        },
        { type: 'finish', finishReason: 'other' },
      ]),
    )

    expect(result).toEqual({ limited: true, reason: 'AI rate limit exceeded' })
  })

  it('passes a normal stream through with every chunk', async () => {
    const chunks: Chunk[] = [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Sunny' },
      { type: 'text-end', id: '1' },
      { type: 'finish' },
    ]

    const result = await peekRateLimit(streamOf(chunks))

    expect(result.limited).toBe(false)
    if (!result.limited) expect(await readAll(result.stream)).toEqual(chunks)
  })

  it('passes through tripwires from other processors', async () => {
    const chunks: Chunk[] = [
      { type: 'data-tripwire', data: { reason: 'blocked', processorId: 'moderation' } },
      { type: 'finish' },
    ]

    const result = await peekRateLimit(streamOf(chunks))

    expect(result.limited).toBe(false)
    if (!result.limited) expect(await readAll(result.stream)).toEqual(chunks)
  })
})
