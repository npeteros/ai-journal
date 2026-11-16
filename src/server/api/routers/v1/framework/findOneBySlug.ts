import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'

const promptsSchema = z.array(z.object({ prompt: z.string(), sample: z.string().optional() }))

// One framework with its prompts. Unknown slug → NOT_FOUND (the page shows not-found).
export const findOneBySlug = protectedProcedure
  .input(z.object({ slug: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.user.id
    const row = await prisma.framework.findFirst({
      where: { slug: input.slug, deletedAt: null, OR: [{ userId: null }, { userId }] },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        minutes: true,
        icon: true,
        prompts: true,
      },
    })
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })
    return { ...row, prompts: promptsSchema.parse(row.prompts) }
  })
