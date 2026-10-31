import { z } from 'zod'

const titleSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))

const bodySchema = z.string().trim().min(1)

const writtenAtSchema = z.string().datetime({ offset: true })

// Each name is trimmed and 1-32 chars; duplicates removed case-insensitively
// (first occurrence wins, matching Tag.normalizedName = trim + lowercase).
const tagsSchema = z.array(z.string().trim().min(1).max(32)).transform((names) => {
  const seen = new Set<string>()
  return names.filter((name) => {
    const key = name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

export const EntryCreateSchema = z.object({
  title: titleSchema.optional(),
  body: bodySchema,
  writtenAt: writtenAtSchema.optional(),
  tags: tagsSchema.default([]),
})

export const EntryUpdateSchema = z
  .object({
    title: titleSchema,
    body: bodySchema,
    writtenAt: writtenAtSchema,
    tags: tagsSchema,
  })
  .partial()
  .refine(
    (data) =>
      data.title !== undefined ||
      data.body !== undefined ||
      data.writtenAt !== undefined ||
      data.tags !== undefined,
    {
      message: 'At least one of title, body, writtenAt or tags is required',
    },
  )

export type EntryCreateInput = z.infer<typeof EntryCreateSchema>
export type EntryUpdateInput = z.infer<typeof EntryUpdateSchema>
