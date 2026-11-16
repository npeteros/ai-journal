import {
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VOICE_TRANSCRIPT_MAX_TURNS,
  VOICE_TURN_MAX_LENGTH,
  type VoiceTurn,
} from './voice'

/**
 * GPT-Live streams both sides of the conversation as transcript deltas
 * (`session.input_transcript.delta` for the user, `session.output_transcript.delta` for Jaden),
 * each with `start_ms` and no "done" event. These helpers rebuild readable turns from them.
 */
export type TranscriptDelta = { role: VoiceTurn['role']; text: string; startMs: number }

/** Jaden's short acknowledgements ("Mm-hmm.", "Yeah.") land mid-sentence while the user talks. */
const BACKCHANNEL_MAX_WORDS = 3
/** Sound annotations in speech transcripts, e.g. "[clear throat]", "[lip smack]". */
const SOUND_TAG = /\[[^\]]*\]/g

const words = (text: string) => text.split(/\s+/).filter(Boolean)
const tidy = (text: string) => text.replace(SOUND_TAG, ' ').replace(/\s+/g, ' ').trim()

/** Groups deltas into alternating turns, dropping Jaden's acknowledgements inside a user turn. */
export function toTurns(deltas: TranscriptDelta[]): VoiceTurn[] {
  // Stable sort: deltas with the same start keep their arrival order.
  const ordered = deltas
    .map((delta, index) => ({ delta, index }))
    .sort((a, b) => a.delta.startMs - b.delta.startMs || a.index - b.index)
    .map(({ delta }) => delta)

  const raw: VoiceTurn[] = []
  for (const { role, text } of ordered) {
    const last = raw.at(-1)
    if (last && last.role === role) last.text += text
    else raw.push({ role, text })
  }

  const turns: VoiceTurn[] = []
  raw.forEach((turn, i) => {
    const text = tidy(turn.text)
    if (!text) return
    const isBackchannel =
      turn.role === 'jaden' &&
      words(text).length <= BACKCHANNEL_MAX_WORDS &&
      raw[i - 1]?.role === 'user' &&
      raw[i + 1]?.role === 'user'
    if (isBackchannel) return

    const last = turns.at(-1)
    if (last && last.role === turn.role) last.text = `${last.text} ${text}`
    else turns.push({ role: turn.role, text })
  })
  return turns
}

/** Splits text into chunks of at most `max` characters, at word boundaries where possible. */
function chunk(text: string, max: number): string[] {
  const chunks: string[] = []
  let rest = text
  while (rest.length > max) {
    const space = rest.lastIndexOf(' ', max)
    const cut = space > max / 2 ? space : max
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

/**
 * Fits a conversation into the draft procedure's limits: long turns are split rather than cut,
 * and if it's still too big the oldest turns are dropped (the end of a session matters most).
 */
export function fitTranscript(turns: VoiceTurn[]): VoiceTurn[] {
  const split = turns.flatMap(({ role, text }) =>
    chunk(text.trim(), VOICE_TURN_MAX_LENGTH).map((part) => ({ role, text: part })),
  )
  const fitted: VoiceTurn[] = []
  let total = 0
  for (let i = split.length - 1; i >= 0; i--) {
    const turn = split[i]
    if (fitted.length >= VOICE_TRANSCRIPT_MAX_TURNS) break
    if (total + turn.text.length > VOICE_TRANSCRIPT_MAX_LENGTH) break
    total += turn.text.length
    fitted.unshift(turn)
  }
  return fitted
}

export const hasUserWords = (turns: VoiceTurn[]) =>
  turns.some((turn) => turn.role === 'user' && turn.text.trim() !== '')
