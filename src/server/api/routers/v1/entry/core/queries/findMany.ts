import type { Prisma } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryFindManySchema } from '../../schema'
import { entryWithTagsInclude, parseDateOnly, toEntryDto } from './shared'

export const findMany = protectedProcedure
  .input(EntryFindManySchema)
  .query(async ({ ctx, input }) => {
    const { skip, take, searchText, tagId, entryStartDate, entryEndDate } = input
    const userId = ctx.user.id

    const where: Prisma.EntryWhereInput = {
      userId,
      deletedAt: null,
      ...(searchText !== undefined
        ? {
            OR: [
              { title: { contains: searchText, mode: 'insensitive' } },
              { body: { contains: searchText, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(tagId !== undefined
        ? { tags: { some: { tagId, tag: { userId, deletedAt: null } } } }
        : {}),
      ...(entryStartDate !== undefined || entryEndDate !== undefined
        ? {
            entryDate: {
              ...(entryStartDate !== undefined ? { gte: parseDateOnly(entryStartDate) } : {}),
              ...(entryEndDate !== undefined ? { lte: parseDateOnly(entryEndDate) } : {}),
            },
          }
        : {}),
    }

    const [entries, total] = await prisma.$transaction([
      prisma.entry.findMany({
        where,
        include: entryWithTagsInclude,
        // `id` breaks ties so offset pages stay stable for equal `writtenAt` values.
        orderBy: [{ writtenAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      prisma.entry.count({ where }),
    ])

    return { items: entries.map(toEntryDto), total }
  })
