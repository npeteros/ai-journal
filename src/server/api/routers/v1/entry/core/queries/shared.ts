import type { Prisma } from '@/src/generated/prisma/client'

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
