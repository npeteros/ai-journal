import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkMessages } from '@mastra/ai-sdk/ui'
import { TRPCError } from '@trpc/server'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { mastra } from '@/src/mastra'
import { guardAgentCall } from '@/src/mastra/guardrails/runAgent'
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

  try {
    // Rate limit is checked here, before the model is called.
    const guarded = await guardAgentCall({
      agent: mastra.getAgentById(AGENT_ID),
      userId,
    })

    const stream = await handleChatStream({
      mastra,
      agentId: AGENT_ID,
      version: 'v7',
      params: {
        messages,
        trigger,
        resumeData,
        ...guarded,
        // Stops generation (and fires onAbort) when the client disconnects.
        abortSignal: req.signal,
        memory: {
          thread: threadIdFor(userId),
          resource: userId,
        },
      },
    })
    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    if (error instanceof TRPCError) {
      return NextResponse.json(
        { error: error.message },
        { status: getHTTPStatusCodeFromError(error) },
      )
    }
    throw error
  }
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
