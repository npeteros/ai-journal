import { TRPCError } from '@trpc/server'
import { NextResponse } from 'next/server'

import {
  VOICE_LIMIT_CODE,
  VOICE_LIMIT_MESSAGE,
  VOICE_SESSION_MAX_BODY_BYTES,
  VOICE_UNAVAILABLE_CODE,
  VOICE_UNAVAILABLE_MESSAGE,
  type VoiceErrorBody,
  type VoiceSessionResponse,
} from '@/src/lib/voice'
import { auth } from '@/src/server/auth/auth'
import { voiceSessionService } from '@/src/server/voice/VoiceSessionService'

/** Reads `{ sdp }`, rejecting bodies over the size cap before and after reading them. */
async function parseOffer(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > VOICE_SESSION_MAX_BODY_BYTES) return null
  try {
    const text = await req.text()
    if (text.length > VOICE_SESSION_MAX_BODY_BYTES) return null
    const body: unknown = JSON.parse(text)
    if (typeof body !== 'object' || body === null || !('sdp' in body)) return null
    const { sdp } = body
    return typeof sdp === 'string' && sdp.startsWith('v=') ? sdp : null
  } catch {
    return null
  }
}

/**
 * Starts a spoken journaling session. The browser sends its WebRTC offer; the server checks the
 * voice budget, creates the GPT-Live session with our key and Jaden's fixed instructions, and
 * returns only the SDP answer and the usage row to report against when the session ends.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new NextResponse(null, { status: 401 })

  const sdp = await parseOffer(req)
  if (!sdp) {
    return NextResponse.json<VoiceErrorBody>({ error: 'Invalid session offer' }, { status: 400 })
  }

  try {
    const result = await voiceSessionService.start({
      userId: session.user.id,
      userName: session.user.name,
      sdp,
    })
    return NextResponse.json<VoiceSessionResponse>(result)
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'TOO_MANY_REQUESTS') {
      return NextResponse.json<VoiceErrorBody>(
        { error: VOICE_LIMIT_MESSAGE, code: VOICE_LIMIT_CODE },
        { status: 429 },
      )
    }
    // Details are logged by the service; the client only needs to know to fall back to typing.
    return NextResponse.json<VoiceErrorBody>(
      { error: VOICE_UNAVAILABLE_MESSAGE, code: VOICE_UNAVAILABLE_CODE },
      { status: 502 },
    )
  }
}
