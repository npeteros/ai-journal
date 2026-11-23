import { protectedProcedure } from '@/src/server/trpc/init'
import { userProfileService } from '../../services/UserProfileService'

export const skipWelcome = protectedProcedure.mutation(({ ctx }) =>
  userProfileService.skipWelcome(ctx.user.id),
)
