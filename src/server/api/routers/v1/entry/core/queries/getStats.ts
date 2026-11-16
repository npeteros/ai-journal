import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { entryStatsInput, getEntryStats } from './stats'

export const stats = protectedProcedure
  .input(entryStatsInput)
  .query(({ ctx, input }) => getEntryStats(prisma, ctx.user.id, input))
