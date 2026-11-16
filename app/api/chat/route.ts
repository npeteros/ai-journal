import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse, validateUIMessages } from 'ai'
import { NextResponse } from 'next/server'

import { mastra } from '@/src/mastra'
import { JOURNAL_COMPANION_AGENT_ID } from '@/src/mastra/agents/journal-companion-agent'
import { peekRateLimit } from '@/src/mastra/guardrails/chatStream'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import {
  CHAT_CONTEXT_MESSAGES,
  CHAT_RATE_LIMITED_CODE,
  CHAT_RATE_LIMITED_MESSAGE,
  type ChatErrorBody,
} from '@/src/lib/chat'
import { auth } from '@/src/server/auth/auth'

/**
 * Chat is stateless: nothing is stored server-side, so the client sends the conversation.
 * Only the most recent turns are kept, only user/assistant roles are accepted (no
 * client-supplied system prompts), and the newest message must come from the user.
 */
async function parseMessages(req: Request) {
  try {
    const body: unknown = await req.json()
    if (typeof body !== 'object' || body === null || !('messages' in body)) return null
    if (!Array.isArray(body.messages) || body.messages.length === 0) return null
    const messages = await validateUIMessages({
      messages: body.messages.slice(-CHAT_CONTEXT_MESSAGES),
    })
    if (!messages.every((m) => m.role === 'user' || m.role === 'assistant')) return null
    return messages.at(-1)?.role === 'user' ? messages : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new NextResponse(null, { status: 401 })

  const messages = await parseMessages(req)
  if (!messages) {
    return NextResponse.json<ChatErrorBody>({ error: 'Invalid messages' }, { status: 400 })
  }

  const stream = await handleChatStream({
    mastra,
    agentId: JOURNAL_COMPANION_AGENT_ID,
    version: 'v7',
    params: {
      messages,
      trigger: 'submit-message',
      requestContext: createUserRequestContext(session.user.id),
      abortSignal: req.signal,
    },
  })

  const peeked = await peekRateLimit(stream)
  if (peeked.limited) {
    return NextResponse.json<ChatErrorBody>(
      { error: CHAT_RATE_LIMITED_MESSAGE, code: CHAT_RATE_LIMITED_CODE },
      { status: 429 },
    )
  }
  return createUIMessageStreamResponse({ stream: peeked.stream })
}
