import { protectedProcedure } from '@/src/server/trpc/init'
import { findManyFrameworksForUser } from './shared'

export const findMany = protectedProcedure.query(({ ctx }) =>
  findManyFrameworksForUser(ctx.user.id),
)
