import { z } from 'zod'
import { timeZoneSchema } from '../entry/schema'

export const ANSWER_MAX_LENGTH = 10_000
export const PROMPTS_MAX_COUNT = 50

/** Shape of `framework.prompts` (jsonb). Parsed on every read so the API never returns bad rows. */
export const FrameworkPromptsSchema = z.array(
  z.object({ prompt: z.string(), sample: z.string().optional() }),
)

export const FrameworkSlugSchema = z.object({
  slug: z.string().trim().min(1),
})

export const FrameworkCompleteSchema = z.object({
  frameworkId: z.uuid(),
  // One answer per prompt. Empty answers are skipped, but at least one must have text.
  answers: z
    .array(z.string().max(ANSWER_MAX_LENGTH))
    .min(1)
    .max(PROMPTS_MAX_COUNT)
    .refine((answers) => answers.some((answer) => answer.trim().length > 0), {
      message: 'Answer at least one prompt.',
    }),
  timeZone: timeZoneSchema,
})

export type FrameworkPrompt = z.output<typeof FrameworkPromptsSchema>[number]
export type FrameworkSlugInput = z.input<typeof FrameworkSlugSchema>
export type FrameworkCompleteInput = z.input<typeof FrameworkCompleteSchema>
export type FrameworkCompleteData = z.output<typeof FrameworkCompleteSchema>
