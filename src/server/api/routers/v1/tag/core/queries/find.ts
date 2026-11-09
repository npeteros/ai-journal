import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'

export const findManyTags = protectedProcedure.query(async ({ ctx }) => {
  const tags = await prisma.tag.findMany({
    where: { userId: ctx.user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: {
        // Only entries that are not soft-deleted count towards a tag.
        select: { entries: { where: { entry: { deletedAt: null } } } },
      },
    },
    // `id` breaks ties so the order stays stable for names differing only by case.
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  return tags.map(({ _count, ...tag }) => ({ ...tag, entryCount: _count.entries }))
})
