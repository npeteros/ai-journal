import { validateUIMessages } from 'ai'

/**
 * Chat routes are stateless: nothing is stored server-side, so the client sends the conversation.
 * Only the most recent `limit` messages are kept, only user/assistant roles are accepted (no
 * client-supplied system prompts), and the newest message must come from the user.
 * Returns null when the body isn't a valid conversation.
 */
export async function parseChatMessages(req: Request, limit: number) {
  try {
    const body: unknown = await req.json()
    if (typeof body !== 'object' || body === null || !('messages' in body)) return null
    if (!Array.isArray(body.messages) || body.messages.length === 0) return null
    const messages = await validateUIMessages({ messages: body.messages.slice(-limit) })
    if (!messages.every((m) => m.role === 'user' || m.role === 'assistant')) return null
    return messages.at(-1)?.role === 'user' ? messages : null
  } catch {
    return null
  }
}
