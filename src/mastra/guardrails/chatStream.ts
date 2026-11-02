import { isAiRateLimited, type TripwireInfo } from './AiUsageProcessor'

type UIChunk = { type: string }

export type PeekResult<T extends UIChunk> =
  { limited: true; reason: string } | { limited: false; stream: ReadableStream<T> }

// Chunks that can come before the first content (or tripwire) chunk.
const PREAMBLE_TYPES = new Set(['start', 'start-step'])

function getTripwire(chunk: UIChunk): TripwireInfo | undefined {
  if (chunk.type !== 'data-tripwire' || !('data' in chunk)) return undefined
  const { data } = chunk
  return typeof data === 'object' && data !== null ? data : undefined
}

/**
 * handleChatStream reports an over-limit call as a `data-tripwire` chunk inside a 200 stream.
 * Reads the stream up to its first real chunk so the route can answer 429 instead; otherwise
 * returns a stream that replays the chunks already read, followed by the rest.
 */
export async function peekRateLimit<T extends UIChunk>(
  stream: ReadableStream<T>,
): Promise<PeekResult<T>> {
  const reader = stream.getReader()
  const buffered: T[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffered.push(value)
    if (PREAMBLE_TYPES.has(value.type)) continue

    const tripwire = getTripwire(value)
    if (isAiRateLimited(tripwire)) {
      await reader.cancel()
      return { limited: true, reason: tripwire?.reason ?? 'AI rate limit exceeded' }
    }
    break
  }

  const replay = new ReadableStream<T>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk)
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })

  return { limited: false, stream: replay }
}
