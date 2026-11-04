import { TRPCError } from '@trpc/server'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryDeleteSchema } from '../../schema'

export const deleteEntry = protectedProcedure
  .input(EntryDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const deleted = await prisma.entry.updateMany({
      where: { id: input.id, userId: ctx.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    if (deleted.count === 0) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    return { id: input.id }
  })
