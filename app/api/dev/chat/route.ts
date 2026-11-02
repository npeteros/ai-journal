import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkMessages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { mastra } from '@/src/mastra'
import { peekRateLimit } from '@/src/mastra/guardrails/chatStream'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { auth } from '@/src/server/auth/auth'

// Dev-only demo endpoint for the S1-05 AI layer. Disabled in production builds;
// the Mastra agent and API keys stay server-side.
const isDisabled = process.env.NODE_ENV === 'production'

const AGENT_ID = 'weather-agent'
// One demo thread per user; Mastra threads are owned by a single resource.
const threadIdFor = (userId: string) => `dev-chat-${userId}`

function notFound() {
  return new NextResponse(null, { status: 404 })
}

function unauthorized() {
  return new NextResponse(null, { status: 401 })
}

export async function POST(req: Request) {
  if (isDisabled) return notFound()

  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return unauthorized()

  const userId = session.user.id
  // Only forward what useChat sends; execution options (maxSteps, modelSettings, ...) stay server-controlled.
  const { messages, trigger, resumeData } = await req.json()

  // AiUsageProcessor on the agent enforces the rate limit and records usage from this context.
  const stream = await handleChatStream({
    mastra,
    agentId: AGENT_ID,
    version: 'v7',
    params: {
      messages,
      trigger,
      resumeData,
      requestContext: createUserRequestContext(userId),
      // Stops generation when the client disconnects; the usage row is recorded as failed.
      abortSignal: req.signal,
      memory: {
        thread: threadIdFor(userId),
        resource: userId,
      },
    },
  })

  // Over-limit calls arrive as a tripwire chunk in the stream; answer 429 instead.
  const peeked = await peekRateLimit(stream)
  if (peeked.limited) {
    return NextResponse.json({ error: peeked.reason }, { status: 429 })
  }
  return createUIMessageStreamResponse({ stream: peeked.stream })
}

export async function GET(req: Request) {
  if (isDisabled) return notFound()

  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return unauthorized()

  const memory = await mastra.getAgentById(AGENT_ID).getMemory()
  let response = null

  try {
    response = await memory?.recall({
      threadId: threadIdFor(session.user.id),
      resourceId: session.user.id,
    })
  } catch {
    // No thread yet: start with an empty history.
  }

  return NextResponse.json(toAISdkMessages(response?.messages || [], { version: 'v7' }))
}
