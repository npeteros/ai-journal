import { describe, expect, it } from 'vitest'
import {
  BODY_MAX_LENGTH,
  EntryCreateSchema,
  EntryDeleteSchema,
  EntryFindManySchema,
  EntryUpdateSchema,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  TAGS_MAX_COUNT,
  TITLE_MAX_LENGTH,
} from '@/src/server/api/routers/v1/entry/schema'

const timeZone = 'Asia/Manila'

describe('EntryCreateSchema', () => {
  it('trims fields and defaults tags to []', () => {
    const result = EntryCreateSchema.parse({ title: '  Morning  ', body: '  hello  ', timeZone })
    expect(result).toEqual({ title: 'Morning', body: 'hello', timeZone, tags: [] })
  })

  it('turns an empty title into undefined', () => {
    expect(EntryCreateSchema.parse({ title: '   ', body: 'x', timeZone }).title).toBeUndefined()
  })

  it('rejects a blank body', () => {
    expect(EntryCreateSchema.safeParse({ body: '   ', timeZone }).success).toBe(false)
  })

  it('removes duplicate tags case-insensitively, keeping the first', () => {
    const result = EntryCreateSchema.parse({
      body: 'x',
      timeZone,
      tags: [' Gratitude ', 'gratitude', 'Work'],
    })
    expect(result.tags).toEqual(['Gratitude', 'Work'])
  })

  it('rejects empty and over-long tag names', () => {
    expect(EntryCreateSchema.safeParse({ body: 'x', timeZone, tags: ['  '] }).success).toBe(false)
    expect(
      EntryCreateSchema.safeParse({ body: 'x', timeZone, tags: ['a'.repeat(33)] }).success,
    ).toBe(false)
  })

  it('caps the number of tags', () => {
    const tags = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `tag${i}`)
    expect(EntryCreateSchema.safeParse({ body: 'x', timeZone, tags }).success).toBe(false)
  })

  it('caps title and body length', () => {
    expect(
      EntryCreateSchema.safeParse({ title: 'a'.repeat(TITLE_MAX_LENGTH + 1), body: 'x', timeZone })
        .success,
    ).toBe(false)
    expect(
      EntryCreateSchema.safeParse({ body: 'a'.repeat(BODY_MAX_LENGTH + 1), timeZone }).success,
    ).toBe(false)
  })

  it('accepts ISO datetimes with an offset and rejects other strings', () => {
    expect(
      EntryCreateSchema.safeParse({ body: 'x', timeZone, writtenAt: '2026-08-25T07:00:00+08:00' })
        .success,
    ).toBe(true)
    expect(EntryCreateSchema.safeParse({ body: 'x', timeZone, writtenAt: 'Aug 25' }).success).toBe(
      false,
    )
  })

  it('requires a valid IANA time zone', () => {
    expect(EntryCreateSchema.safeParse({ body: 'x' }).success).toBe(false)
    expect(EntryCreateSchema.safeParse({ body: 'x', timeZone: 'Mars/Olympus' }).success).toBe(false)
  })
})

describe('EntryUpdateSchema', () => {
  it('requires at least one field', () => {
    expect(EntryUpdateSchema.safeParse({}).success).toBe(false)
    expect(EntryUpdateSchema.safeParse({ timeZone }).success).toBe(false)
  })

  it('clears the title with an empty string or null', () => {
    expect(EntryUpdateSchema.parse({ title: '' }).title).toBeNull()
    expect(EntryUpdateSchema.parse({ title: null }).title).toBeNull()
  })

  it('accepts an empty tags array to unlink all tags', () => {
    expect(EntryUpdateSchema.parse({ tags: [] }).tags).toEqual([])
  })

  it('requires timeZone when writtenAt changes', () => {
    const writtenAt = '2026-08-24T23:00:00Z'
    expect(EntryUpdateSchema.safeParse({ writtenAt }).success).toBe(false)
    expect(EntryUpdateSchema.safeParse({ writtenAt, timeZone }).success).toBe(true)
  })
})

describe('EntryFindManySchema', () => {
  it('defaults skip and take', () => {
    expect(EntryFindManySchema.parse({})).toEqual({ skip: 0, take: PAGE_SIZE_DEFAULT })
  })

  it('bounds skip and take', () => {
    expect(EntryFindManySchema.safeParse({ skip: -1 }).success).toBe(false)
    expect(EntryFindManySchema.safeParse({ take: 0 }).success).toBe(false)
    expect(EntryFindManySchema.safeParse({ take: PAGE_SIZE_MAX + 1 }).success).toBe(false)
    expect(EntryFindManySchema.safeParse({ take: 1.5 }).success).toBe(false)
  })

  it('trims searchText and drops it when blank', () => {
    expect(EntryFindManySchema.parse({ searchText: '  walk ' }).searchText).toBe('walk')
    expect(EntryFindManySchema.parse({ searchText: '   ' }).searchText).toBeUndefined()
  })

  it('rejects an invalid tagId', () => {
    expect(EntryFindManySchema.safeParse({ tagId: 'work' }).success).toBe(false)
  })

  it('accepts date-only bounds and rejects other formats', () => {
    expect(EntryFindManySchema.safeParse({ entryStartDate: '2026-08-01' }).success).toBe(true)
    expect(EntryFindManySchema.safeParse({ entryStartDate: '2026-08-01T00:00:00Z' }).success).toBe(
      false,
    )
    expect(EntryFindManySchema.safeParse({ entryEndDate: '2026-02-30' }).success).toBe(false)
  })

  it('rejects a start date after the end date', () => {
    expect(
      EntryFindManySchema.safeParse({ entryStartDate: '2026-08-02', entryEndDate: '2026-08-01' })
        .success,
    ).toBe(false)
    expect(
      EntryFindManySchema.safeParse({ entryStartDate: '2026-08-01', entryEndDate: '2026-08-01' })
        .success,
    ).toBe(true)
  })
})

describe('EntryDeleteSchema', () => {
  it('accepts UUIDs and rejects invalid entry IDs', () => {
    expect(
      EntryDeleteSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success,
    ).toBe(true)
    expect(EntryDeleteSchema.safeParse({ id: 'entry-1' }).success).toBe(false)
  })
})
