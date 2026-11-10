import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryCreateSchema } from '../../schema'
import { entryTitleService } from '../../services/EntryTitleService'
import { scheduleEntryAnalysis } from '../../services/scheduleEntryAnalysis'
import { findOrCreateTags, getEntryDate } from './shared'

export const createEntry = protectedProcedure
  .input(EntryCreateSchema)
  .mutation(async ({ ctx, input }) => {
    const writtenAt = input.writtenAt === undefined ? new Date() : new Date(input.writtenAt)
    const title =
      input.title === undefined
        ? await entryTitleService.generate({ userId: ctx.user.id, body: input.body })
        : input.title

    const entry = await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          userId: ctx.user.id,
          title,
          body: input.body,
          writtenAt,
          entryDate: getEntryDate(writtenAt, input.timeZone),
        },
      })
      const tags = await findOrCreateTags(tx, ctx.user.id, input.tags)

      if (tags.length > 0) {
        await tx.entryTag.createMany({
          data: tags.map((tag) => ({ entryId: entry.id, tagId: tag.id })),
        })
      }

      return entry
    })

    scheduleEntryAnalysis({ entryId: entry.id, userId: ctx.user.id, body: input.body })

    return entry
  })
