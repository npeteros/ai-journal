import { describe, expect, it } from 'vitest'
import {
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VOICE_TRANSCRIPT_MAX_TURNS,
  VOICE_TURN_MAX_LENGTH,
} from '@/src/lib/voice'
import { VoiceDraftSchema } from '../schema'

const user = (text = 'I sat with my coffee.') => ({ role: 'user' as const, text })
const jaden = { role: 'jaden' as const, text: 'How was your morning?' }

describe('VoiceDraftSchema', () => {
  it('accepts a conversation with at least one user turn and trims text', () => {
    expect(VoiceDraftSchema.parse({ turns: [jaden, user('  Slow.  ')] })).toEqual({
      turns: [jaden, user('Slow.')],
    })
  })

  it.each([
    ['no turns', []],
    ['only Jaden', [jaden]],
    ['an unknown role', [{ role: 'system', text: 'hi' }]],
    ['an empty turn', [user('   ')]],
    ['an over-long turn', [user('a'.repeat(VOICE_TURN_MAX_LENGTH + 1))]],
    ['too many turns', Array.from({ length: VOICE_TRANSCRIPT_MAX_TURNS + 1 }, () => user())],
    [
      'too much text overall',
      Array.from(
        { length: Math.ceil(VOICE_TRANSCRIPT_MAX_LENGTH / VOICE_TURN_MAX_LENGTH) + 1 },
        () => user('a'.repeat(VOICE_TURN_MAX_LENGTH)),
      ),
    ],
  ])('rejects %s', (_label, turns) => {
    expect(VoiceDraftSchema.safeParse({ turns }).success).toBe(false)
  })
})
