import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryFindManySchema } from '../../schema'
import { findManyEntriesForUser } from './shared'

export const findMany = protectedProcedure
  .input(EntryFindManySchema)
  .query(async ({ ctx, input }) => {
    return findManyEntriesForUser(ctx.user.id, input)
  })
