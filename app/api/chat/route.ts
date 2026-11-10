import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse, validateUIMessages } from 'ai'
import { NextResponse } from 'next/server'

import { mastra } from '@/src/mastra'
import { peekRateLimit } from '@/src/mastra/guardrails/chatStream'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import {
  CHAT_RATE_LIMITED_CODE,
  CHAT_RATE_LIMITED_MESSAGE,
  type ChatErrorBody,
} from '@/src/lib/chat'
import { auth } from '@/src/server/auth/auth'
import { CHAT_AGENT_ID, chatThreadId } from '@/src/server/chat/thread'

async function parseUserMessage(req: Request) {
  try {
    const body: unknown = await req.json()
    if (typeof body !== 'object' || body === null || !('message' in body)) return null
    const [message] = await validateUIMessages({ messages: [body.message] })
    return message?.role === 'user' ? message : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new NextResponse(null, { status: 401 })

  const message = await parseUserMessage(req)
  if (!message) {
    return NextResponse.json<ChatErrorBody>({ error: 'Invalid message' }, { status: 400 })
  }

  const userId = session.user.id

  const stream = await handleChatStream({
    mastra,
    agentId: CHAT_AGENT_ID,
    version: 'v7',
    params: {
      messages: [message],
      trigger: 'submit-message',
      requestContext: createUserRequestContext(userId),
      abortSignal: req.signal,
      memory: { thread: chatThreadId(userId), resource: userId },
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
