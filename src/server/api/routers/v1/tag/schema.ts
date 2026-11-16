import { z } from 'zod'
import { TAG_NAME_MAX_LENGTH } from '../entry/schema'

const tagIdSchema = z.uuid()

export const TagUpdateSchema = z.object({
  id: tagIdSchema,
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
})

export const TagDeleteSchema = z.object({
  id: tagIdSchema,
})

export type TagUpdateInput = z.input<typeof TagUpdateSchema>
export type TagUpdateData = z.output<typeof TagUpdateSchema>
