import { TRPCError } from '@trpc/server'
import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryIdSchema } from '../../schema'
import { findOneEntryForUser } from './shared'

export const findOne = protectedProcedure.input(EntryIdSchema).query(async ({ ctx, input }) => {
  // Another user's entry is reported as NOT_FOUND so its existence is not revealed.
  const entry = await findOneEntryForUser(ctx.user.id, input.id)

  if (!entry) {
    throw new TRPCError({ code: 'NOT_FOUND' })
  }

  return entry
})
