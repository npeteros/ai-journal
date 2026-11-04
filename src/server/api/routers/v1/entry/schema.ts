import { z } from 'zod'

export const TITLE_MAX_LENGTH = 200
export const BODY_MAX_LENGTH = 50_000
export const TAG_NAME_MAX_LENGTH = 32
export const TAGS_MAX_COUNT = 20

// Title is optional in input, but `entry.title` is NOT NULL. When it's empty
// (`undefined` on create, `null` on update), the entry procedures must set an
// AI-generated title before writing.
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

export const EntryIdSchema = z.object({
  id: z.uuid(),
})

export const EntryDeleteSchema = EntryIdSchema

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100
export const SEARCH_TEXT_MAX_LENGTH = 200

export const EntryFindManySchema = z
  .object({
    skip: z.number().int().min(0).default(0),
    take: z.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
    searchText: z
      .string()
      .trim()
      .max(SEARCH_TEXT_MAX_LENGTH)
      .transform((value) => (value === '' ? undefined : value))
      .optional(),
    tagId: z.uuid().optional(),
    entryStartDate: z.iso.date().optional(),
    entryEndDate: z.iso.date().optional(),
  })
  .refine(
    ({ entryStartDate, entryEndDate }) =>
      entryStartDate === undefined || entryEndDate === undefined || entryStartDate <= entryEndDate,
    { message: 'entryStartDate must be on or before entryEndDate', path: ['entryEndDate'] },
  )

export type EntryCreateInput = z.input<typeof EntryCreateSchema>
export type EntryCreateData = z.output<typeof EntryCreateSchema>
export type EntryUpdateInput = z.input<typeof EntryUpdateSchema>
export type EntryUpdateData = z.output<typeof EntryUpdateSchema>
export type EntryFindManyInput = z.input<typeof EntryFindManySchema>
export type EntryFindManyData = z.output<typeof EntryFindManySchema>
