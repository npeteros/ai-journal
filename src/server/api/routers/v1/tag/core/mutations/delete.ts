import { TRPCError } from '@trpc/server'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { TagDeleteSchema } from '../../schema'

// Soft delete only: tags are never hard-deleted. Entry and filter queries already
// exclude tags with `deletedAt` set, and re-using the name restores the tag.
export const deleteTag = protectedProcedure
  .input(TagDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const deleted = await prisma.tag.updateMany({
      where: { id: input.id, userId: ctx.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    if (deleted.count === 0) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    return { id: input.id }
  })
