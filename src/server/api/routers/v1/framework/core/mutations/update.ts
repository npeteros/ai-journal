import { TRPCError } from '@trpc/server'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'

import { FrameworkUpdateSchema } from '../../schema'

export const updateFramework = protectedProcedure
  .input(FrameworkUpdateSchema)
  .mutation(async ({ ctx, input: { id, ...input } }) => {
    const updated = await prisma.framework.updateMany({
      where: { id, userId: ctx.user.id, deletedAt: null },
      data: {
        ...input,
        minutes: input.minutes ?? input.prompts.length * 2,
      },
    })

    if (updated.count === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })
    }

    return { id }
  })
