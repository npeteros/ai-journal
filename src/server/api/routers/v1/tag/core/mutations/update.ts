import { TRPCError } from '@trpc/server'
import { Prisma } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { TagUpdateSchema } from '../../schema'

const CONFLICT_MESSAGE = 'A tag with this name already exists'

export const updateTag = protectedProcedure
  .input(TagUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id
    const normalizedName = input.name.toLowerCase()

    // Another user's tag is reported as NOT_FOUND so its existence is not revealed.
    const tag = await prisma.tag.findFirst({
      where: { id: input.id, userId, deletedAt: null },
      select: { id: true },
    })

    if (!tag) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    // The unique index on (userId, normalizedName) also covers soft-deleted tags, so
    // they are included here. Renaming a tag to its own name in another case is allowed.
    const conflict = await prisma.tag.findFirst({
      where: { userId, normalizedName, id: { not: input.id } },
      select: { id: true },
    })

    if (conflict) {
      throw new TRPCError({ code: 'CONFLICT', message: CONFLICT_MESSAGE })
    }

    try {
      const updated = await prisma.tag.updateMany({
        where: { id: input.id, userId, deletedAt: null },
        data: { name: input.name, normalizedName },
      })

      if (updated.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
    } catch (error) {
      // A concurrent rename or entry write can claim the name after the check above.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new TRPCError({ code: 'CONFLICT', message: CONFLICT_MESSAGE })
      }
      throw error
    }

    return { id: input.id, name: input.name }
  })
