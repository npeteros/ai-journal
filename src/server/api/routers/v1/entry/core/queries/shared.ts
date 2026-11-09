import type { Prisma } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import type { EntryFindManyData } from '../../schema'

export const entryWithTagsInclude = {
  tags: {
    where: { tag: { deletedAt: null } },
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.EntryInclude

type EntryWithTags = Prisma.EntryGetPayload<{ include: typeof entryWithTagsInclude }>

export function toEntryDto({ tags, ...entry }: EntryWithTags) {
  return { ...entry, tags: tags.map(({ tag }) => tag) }
}

export type EntryDto = ReturnType<typeof toEntryDto>

/** Converts a `YYYY-MM-DD` string to the UTC-midnight Date stored in `entry.entryDate`. */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function entryWhereForUser(userId: string, input: EntryFindManyData) {
  const { searchText, tagId, entryStartDate, entryEndDate } = input

  return {
    userId,
    deletedAt: null,
    ...(searchText !== undefined
      ? {
          OR: [
            { title: { contains: searchText, mode: 'insensitive' as const } },
            { body: { contains: searchText, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(tagId !== undefined ? { tags: { some: { tagId, tag: { userId, deletedAt: null } } } } : {}),
    ...(entryStartDate !== undefined || entryEndDate !== undefined
      ? {
          entryDate: {
            ...(entryStartDate !== undefined ? { gte: parseDateOnly(entryStartDate) } : {}),
            ...(entryEndDate !== undefined ? { lte: parseDateOnly(entryEndDate) } : {}),
          },
        }
      : {}),
  } satisfies Prisma.EntryWhereInput
}

/** Reads only active entries owned by the trusted server-side user ID. */
export async function findManyEntriesForUser(userId: string, input: EntryFindManyData) {
  const where = entryWhereForUser(userId, input)
  const [entries, total] = await prisma.$transaction([
    prisma.entry.findMany({
      where,
      include: entryWithTagsInclude,
      // `id` breaks ties so offset pages stay stable for equal `writtenAt` values.
      orderBy: [{ writtenAt: 'desc' }, { id: 'desc' }],
      skip: input.skip,
      take: input.take,
    }),
    prisma.entry.count({ where }),
  ])

  return { items: entries.map(toEntryDto), total }
}

/** Returns an active entry only when it belongs to the trusted server-side user ID. */
export async function findOneEntryForUser(userId: string, id: string) {
  const entry = await prisma.entry.findFirst({
    where: { id, userId, deletedAt: null },
    include: entryWithTagsInclude,
  })

  return entry ? toEntryDto(entry) : null
}
