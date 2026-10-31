import { z } from 'zod'

export const TITLE_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 50_000
export const TAG_NAME_MAX_LENGTH = 32
export const TAGS_MAX_COUNT = 20

const baseTitleSchema = z.string().trim().max(TITLE_MAX_LENGTH)

const createTitleSchema = baseTitleSchema.transform((value) => (value === '' ? undefined : value))

const updateTitleSchema = baseTitleSchema
  .nullable()
  .transform((value) => (value === '' || value === null ? null : value))

const bodySchema = z.string().trim().min(1).max(BODY_MAX_LENGTH)

const writtenAtSchema = z.iso.datetime({ offset: true })

const timeZoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value })
      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid IANA time zone' },
)

const tagsSchema = z
  .array(z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH))
  .max(TAGS_MAX_COUNT)
  .transform((names) => {
    const seen = new Set<string>()
    return names.filter((name) => {
      const key = name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })

export const EntryCreateSchema = z.object({
  title: createTitleSchema.optional(),
  body: bodySchema,
  writtenAt: writtenAtSchema.optional(),
  timeZone: timeZoneSchema,
  tags: tagsSchema.default([]),
})

const entryUpdateFields = z
  .object({
    title: updateTitleSchema,
    body: bodySchema,
    writtenAt: writtenAtSchema,
    tags: tagsSchema,
  })
  .partial()

export const EntryUpdateSchema = entryUpdateFields
  .extend({ timeZone: timeZoneSchema.optional() })
  .refine(
    ({ timeZone: _timeZone, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: 'At least one of title, body, writtenAt or tags is required' },
  )
  .refine((data) => data.writtenAt === undefined || data.timeZone !== undefined, {
    message: 'timeZone is required when writtenAt is provided',
    path: ['timeZone'],
  })

export type EntryCreateInput = z.input<typeof EntryCreateSchema>
export type EntryCreateData = z.output<typeof EntryCreateSchema>
export type EntryUpdateInput = z.input<typeof EntryUpdateSchema>
export type EntryUpdateData = z.output<typeof EntryUpdateSchema>
