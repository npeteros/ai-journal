import { TRPCError } from '@trpc/server'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { FrameworkDeleteSchema } from '../../schema'

export const deleteFramework = protectedProcedure
  .input(FrameworkDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const deleted = await prisma.framework.updateMany({
      where: { id: input.id, userId: ctx.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (deleted.count === 0)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })
    return { id: input.id }
  })
