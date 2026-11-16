import { Prisma } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { FrameworkCreateSchema } from '@/src/server/api/routers/v1/framework/schema'

const slugFor = (title: string) =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'framework'
  }-${crypto.randomUUID().slice(0, 8)}`

export const create = protectedProcedure
  .input(FrameworkCreateSchema)
  .mutation(async ({ ctx, input }) => {
    const data = {
      ...input,
      prompts: input.prompts.map((prompt) => ({ prompt })),
      minutes: input.minutes ?? input.prompts.length * 2,
      userId: ctx.user.id,
    }
    for (let attempt = 1; ; attempt++) {
      try {
        return await prisma.framework.create({
          data: { ...data, slug: slugFor(input.title) },
          select: { id: true, slug: true },
        })
      } catch (error) {
        const taken =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
        if (!taken || attempt === 3) throw error
      }
    }
  })
