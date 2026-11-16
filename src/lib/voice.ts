/** Shared between the voice journaling routes and the client. */

export const VOICE_SESSION_API = '/api/voice/session'
export const VOICE_SESSION_END_API = '/api/voice/session/end'
export const VOICE_CHAT_API = '/api/voice/chat'

/** Most recent messages the typing fallback sends per turn (the whole conversation for a 10-minute session). */
export const VOICE_CHAT_CONTEXT_MESSAGES = 60

/** Client-side cap on a spoken session. The server records at most this much per session. */
export const VOICE_MAX_SECONDS = 600

/** Largest request body the session route accepts. A WebRTC offer is a few KB. */
export const VOICE_SESSION_MAX_BODY_BYTES = 32 * 1024

export const VOICE_LIMIT_CODE = 'VOICE_LIMIT'
export const VOICE_LIMIT_MESSAGE =
  "You've used today's voice sessions with JADEN. You can keep going by typing instead."

export const VOICE_UNAVAILABLE_CODE = 'VOICE_UNAVAILABLE'
export const VOICE_UNAVAILABLE_MESSAGE =
  "JADEN's voice isn't available right now. You can keep going by typing instead."

export type VoiceErrorBody = { error: string; code?: string }

export type VoiceSessionResponse = {
  /** WebRTC answer to apply with setRemoteDescription. */
  sdp: string
  /** Usage row to report the session length against when it ends. */
  usageId: string
  maxSeconds: number
}

export type VoiceSessionEndRequest = { usageId: string; seconds: number }

/** Sent by the client right after the session starts, so Jaden speaks first instead of waiting. */
export const VOICE_GREETING_CUE = 'Greet the user now.'

export type VoiceTurn = { role: 'jaden' | 'user'; text: string }

/** Bounds on the transcript sent for drafting and as typing-fallback context. */
export const VOICE_TRANSCRIPT_MAX_TURNS = 200
export const VOICE_TURN_MAX_LENGTH = 4000
export const VOICE_TRANSCRIPT_MAX_LENGTH = 60_000
