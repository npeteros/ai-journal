import 'server-only'

/**
 * Minimal client for OpenAI GPT-Live session creation over WebRTC. The session is created
 * server-side with our API key; the browser only ever receives the SDP answer.
 * Event and field names were verified in the #72 spike (see the issue).
 */

export const GPT_LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions'
export const GPT_LIVE_MODEL = 'gpt-live-1'
export const GPT_LIVE_VOICE = 'marin'

/**
 * The only events the browser may send on the data channel. OpenAI rejects anything else with
 * `event_not_allowed`, so a modified client can't mute, re-instruct or reconfigure the session.
 */
export const ALLOWED_CLIENT_EVENTS = ['session.close', 'session.commentary.append'] as const

export type CreateLiveSessionInput = {
  sdp: string
  instructions: string
  greeting: string
  safetyIdentifier: string
}

export type LiveSession = { sessionId: string; sdp: string }

export class LiveSessionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'LiveSessionError'
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export function buildLiveSessionRequest({
  sdp,
  instructions,
  greeting,
  safetyIdentifier,
}: CreateLiveSessionInput) {
  return {
    session: {
      model: GPT_LIVE_MODEL,
      instructions,
      audio: { output: { voice: GPT_LIVE_VOICE } },
      input: [
        { type: 'message', role: 'developer', content: [{ type: 'input_text', text: greeting }] },
      ],
      safety_identifier: safetyIdentifier,
      client: { data_channel: { allowed_client_events: [...ALLOWED_CLIENT_EVENTS] } },
    },
    transport: { type: 'webrtc', sdp },
  }
}

function readAnswer(body: unknown): LiveSession | null {
  if (typeof body !== 'object' || body === null) return null
  if (!('session' in body) || !('transport' in body)) return null
  const { session, transport } = body
  if (typeof session !== 'object' || session === null || !('id' in session)) return null
  if (typeof transport !== 'object' || transport === null || !('sdp' in transport)) return null
  if (typeof session.id !== 'string' || typeof transport.sdp !== 'string') return null
  return { sessionId: session.id, sdp: transport.sdp }
}

export async function createLiveSession(
  input: CreateLiveSessionInput,
  fetchImpl: FetchLike = fetch,
  apiKey: string | undefined = process.env.OPENAI_API_KEY,
): Promise<LiveSession> {
  if (!apiKey) throw new LiveSessionError('OPENAI_API_KEY is not set')

  let response: Response
  try {
    response = await fetchImpl(GPT_LIVE_SESSIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLiveSessionRequest(input)),
    })
  } catch (error) {
    throw new LiveSessionError(`GPT-Live request failed: ${String(error)}`)
  }

  const text = await response.text()
  if (!response.ok) {
    // OpenAI error bodies describe the request, not the user's audio; safe to keep for logs.
    throw new LiveSessionError(
      `GPT-Live session creation failed (${response.status}): ${text.slice(0, 500)}`,
      response.status,
    )
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  const answer = readAnswer(body)
  if (!answer)
    throw new LiveSessionError('GPT-Live returned an unexpected response', response.status)
  return answer
}
