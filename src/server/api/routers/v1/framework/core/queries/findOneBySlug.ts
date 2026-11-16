import { TRPCError } from '@trpc/server'

import { protectedProcedure } from '@/src/server/trpc/init'
import { FrameworkSlugSchema } from '../../schema'
import { findOneFrameworkBySlugForUser } from './shared'

/** One framework with its prompts. An unknown slug is NOT_FOUND, which the page shows as not-found. */
export const findOneBySlug = protectedProcedure
  .input(FrameworkSlugSchema)
  .query(async ({ ctx, input }) => {
    const framework = await findOneFrameworkBySlugForUser(ctx.user.id, input.slug)
    if (!framework) throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })
    return framework
  })
