import { z } from 'zod'
import {
  VOICE_TRANSCRIPT_MAX_LENGTH,
  VOICE_TRANSCRIPT_MAX_TURNS,
  VOICE_TURN_MAX_LENGTH,
} from '@/src/lib/voice'

export const voiceTurnSchema = z.object({
  role: z.enum(['jaden', 'user']),
  text: z.string().trim().min(1).max(VOICE_TURN_MAX_LENGTH),
})

export const VoiceDraftSchema = z.object({
  turns: z
    .array(voiceTurnSchema)
    .min(1)
    .max(VOICE_TRANSCRIPT_MAX_TURNS)
    .refine((turns) => turns.some((turn) => turn.role === 'user'), {
      message: 'The conversation has nothing from you to draft.',
    })
    .refine(
      (turns) =>
        turns.reduce((total, turn) => total + turn.text.length, 0) <= VOICE_TRANSCRIPT_MAX_LENGTH,
      { message: 'The conversation is too long to draft.' },
    ),
})

export type VoiceDraftInput = z.infer<typeof VoiceDraftSchema>
