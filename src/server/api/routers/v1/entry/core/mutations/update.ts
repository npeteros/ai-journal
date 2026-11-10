import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryUpdateSchema } from '../../schema'
import { entryTitleService } from '../../services/EntryTitleService'
import { scheduleEntryAnalysis } from '../../services/scheduleEntryAnalysis'
import { findOrCreateTags, getEntryDate } from './shared'

const EntryUpdateWithIdSchema = z.object({ id: z.uuid() }).and(EntryUpdateSchema)

export const updateEntry = protectedProcedure
  .input(EntryUpdateWithIdSchema)
  .mutation(async ({ ctx, input }) => {
    const existingEntry = await prisma.entry.findFirst({
      where: { id: input.id, userId: ctx.user.id, deletedAt: null },
      select: { body: true, title: true },
    })

    if (!existingEntry) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    const body = input.body ?? existingEntry.body
    const title =
      input.title === null
        ? await entryTitleService.generate({ userId: ctx.user.id, body })
        : input.title

    const entry = await prisma.$transaction(async (tx) => {
      if (input.tags !== undefined) {
        const tags = await findOrCreateTags(tx, ctx.user.id, input.tags)

        await tx.entryTag.deleteMany({ where: { entryId: input.id } })
        if (tags.length > 0) {
          await tx.entryTag.createMany({
            data: tags.map((tag) => ({ entryId: input.id, tagId: tag.id })),
          })
        }
      }

      const updated = await tx.entry.updateMany({
        where: { id: input.id, userId: ctx.user.id, deletedAt: null },
        data: {
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(input.writtenAt !== undefined
            ? {
                writtenAt: new Date(input.writtenAt),
                entryDate: getEntryDate(new Date(input.writtenAt), input.timeZone!),
              }
            : {}),
        },
      })

      if (updated.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return tx.entry.findUniqueOrThrow({ where: { id: input.id } })
    })

    // Title-, tag- and date-only edits keep the existing analysis.
    if (input.body !== undefined && input.body !== existingEntry.body) {
      scheduleEntryAnalysis({ entryId: entry.id, userId: ctx.user.id, body: input.body })
    }

    return entry
  })
