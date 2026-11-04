import { TRPCError } from '@trpc/server'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryIdSchema } from '../../schema'
import { entryWithTagsInclude, toEntryDto } from './shared'

export const findOne = protectedProcedure.input(EntryIdSchema).query(async ({ ctx, input }) => {
  // Another user's entry is reported as NOT_FOUND so its existence is not revealed.
  const entry = await prisma.entry.findFirst({
    where: { id: input.id, userId: ctx.user.id, deletedAt: null },
    include: entryWithTagsInclude,
  })

  if (!entry) {
    throw new TRPCError({ code: 'NOT_FOUND' })
  }

  return toEntryDto(entry)
})
