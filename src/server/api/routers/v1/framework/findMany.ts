import { z } from 'zod'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'

const promptsSchema = z.array(z.object({ prompt: z.string(), sample: z.string().optional() }))

// Built-in templates (userId null) and, later, the user's own. Soft-deleted rows are hidden.
export const findMany = protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.user.id
  const rows = await prisma.framework.findMany({
    where: { deletedAt: null, OR: [{ userId: null }, { userId }] },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      minutes: true,
      icon: true,
      prompts: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({ ...r, prompts: promptsSchema.parse(r.prompts) }))
})
