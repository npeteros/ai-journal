import { describe, expect, it } from 'vitest'
import {
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VOICE_TRANSCRIPT_MAX_TURNS,
  VOICE_TURN_MAX_LENGTH,
} from '../voice'
import { fitTranscript, hasUserWords, toTurns, type TranscriptDelta } from '../voice-transcript'

const jaden = (text: string, startMs: number): TranscriptDelta => ({ role: 'jaden', text, startMs })
const user = (text: string, startMs: number): TranscriptDelta => ({ role: 'user', text, startMs })

describe('toTurns', () => {
  it('rebuilds turns from the delta sequence seen in the GPT-Live spike', () => {
    // Shape of spike run 1: deltas, sound tags, and Jaden's "Mm-hmm" landing mid-sentence.
    const deltas = [
      jaden(' Hey Maya,', 26_000),
      jaden(" I'm Jaden.", 26_400),
      jaden(" How's your day going so far?", 26_900),
      user(' Um', 33_600),
      user(' .Hello', 34_000),
      jaden(" Hey! What's been on your mind today?", 37_000),
      user(" Um. I've been feeling a lot tired", 42_000),
      jaden(' Mm-h', 46_000),
      user(' lately', 46_100),
      jaden('mm.', 46_200),
      user(" [clear throat ]I haven't really had rest", 60_000),
      jaden(' Mm-hmm.', 72_000),
      user(' . Um [lip smack] Feels Yeah', 73_000),
      jaden(' Yeah, that sounds pretty draining.', 80_000),
    ]

    expect(toTurns(deltas)).toEqual([
      { role: 'jaden', text: "Hey Maya, I'm Jaden. How's your day going so far?" },
      { role: 'user', text: 'Um .Hello' },
      { role: 'jaden', text: "Hey! What's been on your mind today?" },
      {
        role: 'user',
        text: "Um. I've been feeling a lot tired lately I haven't really had rest . Um Feels Yeah",
      },
      { role: 'jaden', text: 'Yeah, that sounds pretty draining.' },
    ])
  })

  it('orders deltas by start time, keeping arrival order for ties', () => {
    expect(
      toTurns([user(' second', 200), jaden('Hi.', 0), user(' first', 100), user(' tie', 200)]),
    ).toEqual([
      { role: 'jaden', text: 'Hi.' },
      { role: 'user', text: 'first second tie' },
    ])
  })

  it('keeps short Jaden replies that are real turns', () => {
    expect(toTurns([user('I slept badly.', 0), jaden('Oh no.', 100)])).toEqual([
      { role: 'user', text: 'I slept badly.' },
      { role: 'jaden', text: 'Oh no.' },
    ])
  })

  it('drops empty and tag-only turns', () => {
    expect(toTurns([user(' [cough] ', 0), jaden('  ', 10)])).toEqual([])
  })
})

describe('fitTranscript', () => {
  it('splits over-long turns at word boundaries instead of cutting them', () => {
    const long = Array.from({ length: 1500 }, () => 'word').join(' ') // 7,499 characters
    const fitted = fitTranscript([{ role: 'user', text: long }])

    expect(fitted.length).toBe(2)
    expect(fitted.every((turn) => turn.text.length <= VOICE_TURN_MAX_LENGTH)).toBe(true)
    expect(fitted.map((turn) => turn.text).join(' ')).toBe(long)
  })

  it('keeps the most recent turns when the conversation is too big', () => {
    const turns = Array.from({ length: VOICE_TRANSCRIPT_MAX_TURNS + 10 }, (_, i) => ({
      role: 'user' as const,
      text: `turn ${i}`,
    }))
    const fitted = fitTranscript(turns)

    expect(fitted).toHaveLength(VOICE_TRANSCRIPT_MAX_TURNS)
    expect(fitted.at(-1)?.text).toBe(`turn ${VOICE_TRANSCRIPT_MAX_TURNS + 9}`)
  })

  it('stays within the total length limit', () => {
    const turns = Array.from({ length: 20 }, () => ({
      role: 'user' as const,
      text: 'a'.repeat(VOICE_TURN_MAX_LENGTH),
    }))
    const total = fitTranscript(turns).reduce((sum, turn) => sum + turn.text.length, 0)

    expect(total).toBeLessThanOrEqual(VOICE_TRANSCRIPT_MAX_LENGTH)
  })
})

describe('hasUserWords', () => {
  it('needs at least one non-empty user turn', () => {
    expect(hasUserWords([{ role: 'jaden', text: 'Hi' }])).toBe(false)
    expect(hasUserWords([{ role: 'user', text: 'Hello' }])).toBe(true)
  })
})
