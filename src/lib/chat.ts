import { APICallError } from 'ai'

export const CHAT_API = '/api/chat'

export const CHAT_RATE_LIMITED_CODE = 'RATE_LIMITED'
export const CHAT_RATE_LIMITED_MESSAGE =
  "You've reached your limit for JADEN for now. Take a breather and try again a little later."

export type ChatErrorBody = { error: string; code?: string }

/** Most recent messages the client sends per turn; chat is stateless, so this is the model's context. */
export const CHAT_CONTEXT_MESSAGES = 20

/**
 * The friendly message for a 429 from a chat route (`useChat` error), or null for any other error.
 * Prefers the message the route sent, falling back to the default copy.
 */
export function chatRateLimitMessage(error: Error | undefined): string | null {
  if (!error || !APICallError.isInstance(error) || error.statusCode !== 429) return null
  try {
    const body: unknown = JSON.parse(error.responseBody ?? '')
    if (typeof body === 'object' && body !== null && 'code' in body && 'error' in body) {
      if (body.code === CHAT_RATE_LIMITED_CODE && typeof body.error === 'string') return body.error
    }
  } catch {
    // Non-JSON body: fall back to the default copy.
  }
  return CHAT_RATE_LIMITED_MESSAGE
}
