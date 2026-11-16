import type { z } from 'zod'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryCreateSchema } from '../../schema'
import { entryTitleService } from '../../services/EntryTitleService'
import { scheduleEntryAnalysis } from '../../services/scheduleEntryAnalysis'
import { findOrCreateTags, getEntryDate } from './shared'

type EntryCreateInput = z.infer<typeof EntryCreateSchema>

// The single create path. Used by entry.create and by framework.complete,
// so a guided entry gets the same title, tags, entry date and analysis as any other.
export async function createEntryForUser(
  userId: string,
  input: EntryCreateInput,
  extra: { frameworkId?: string } = {},
) {
  const writtenAt = input.writtenAt === undefined ? new Date() : new Date(input.writtenAt)
  const title =
    input.title === undefined
      ? await entryTitleService.generate({ userId, body: input.body })
      : input.title

  const entry = await prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        userId,
        title,
        body: input.body,
        writtenAt,
        entryDate: getEntryDate(writtenAt, input.timeZone),
        frameworkId: extra.frameworkId,
      },
    })
    const tags = await findOrCreateTags(tx, userId, input.tags)

    if (tags.length > 0) {
      await tx.entryTag.createMany({
        data: tags.map((tag) => ({ entryId: entry.id, tagId: tag.id })),
      })
    }

    return entry
  })

  scheduleEntryAnalysis({ entryId: entry.id, userId, body: input.body })

  return entry
}

export const createEntry = protectedProcedure
  .input(EntryCreateSchema)
  .mutation(({ ctx, input }) => createEntryForUser(ctx.user.id, input))
