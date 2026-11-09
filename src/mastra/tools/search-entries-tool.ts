import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { findManyEntriesForUser } from '@/src/server/api/routers/v1/entry/core/queries/shared'
import { USER_ID_KEY } from '../guardrails/requestContext'

export const ENTRY_SEARCH_LIMIT = 10
export const ENTRY_EXCERPT_MAX_LENGTH = 400

const searchEntriesInputSchema = z
  .object({
    keyword: z.string().trim().max(200).optional(),
    entryStartDate: z.iso.date().optional(),
    entryEndDate: z.iso.date().optional(),
  })
  .refine(
    ({ entryStartDate, entryEndDate }) =>
      entryStartDate === undefined || entryEndDate === undefined || entryStartDate <= entryEndDate,
    { message: 'entryStartDate must be on or before entryEndDate', path: ['entryEndDate'] },
  )

const citationSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
})

function entryDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function excerpt(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim()
  return normalized.length <= ENTRY_EXCERPT_MAX_LENGTH
    ? normalized
    : `${normalized.slice(0, ENTRY_EXCERPT_MAX_LENGTH - 3)}...`
}

export const searchEntriesTool = createTool({
  id: 'search-entries',
  description:
    "Search the authenticated user's journal entries by keyword and optional date range.",
  inputSchema: searchEntriesInputSchema,
  outputSchema: z.object({
    entries: z.array(citationSchema.extend({ excerpt: z.string() })),
  }),
  execute: async ({ keyword, entryStartDate, entryEndDate }, { requestContext }) => {
    const userId = requestContext?.get(USER_ID_KEY)
    if (typeof userId !== 'string' || userId.length === 0) return { entries: [] }

    const { items } = await findManyEntriesForUser(userId, {
      skip: 0,
      take: ENTRY_SEARCH_LIMIT,
      searchText: keyword === '' ? undefined : keyword,
      entryStartDate,
      entryEndDate,
    })

    return {
      entries: items.map((entry) => ({
        id: entry.id,
        title: entry.title,
        date: entryDate(entry.entryDate),
        excerpt: excerpt(entry.body),
      })),
    }
  },
})
