import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'

import { mastra } from '@/src/mastra'
import { VOICE_COMPANION_AGENT_ID } from '@/src/mastra/agents/voice-companion-agent'
import { peekRateLimit } from '@/src/mastra/guardrails/chatStream'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import {
  CHAT_RATE_LIMITED_CODE,
  CHAT_RATE_LIMITED_MESSAGE,
  type ChatErrorBody,
} from '@/src/lib/chat'
import { VOICE_CHAT_CONTEXT_MESSAGES } from '@/src/lib/voice'
import { auth } from '@/src/server/auth/auth'
import { parseChatMessages } from '@/src/server/chat/parseChatMessages'

/**
 * Typing fallback for voice journaling: the same guided conversation with Jaden, in text. The
 * client sends the conversation so far (including any turns transcribed from the spoken session).
 * Counts toward the shared AI limit through the agent's aiUsageProcessor.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new NextResponse(null, { status: 401 })

  const messages = await parseChatMessages(req, VOICE_CHAT_CONTEXT_MESSAGES)
  if (!messages) {
    return NextResponse.json<ChatErrorBody>({ error: 'Invalid messages' }, { status: 400 })
  }

  const stream = await handleChatStream({
    mastra,
    agentId: VOICE_COMPANION_AGENT_ID,
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
