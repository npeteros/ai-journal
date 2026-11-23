import { protectedProcedure } from '@/src/server/trpc/init'
import { userProfileService } from '../../services/UserProfileService'

/** Settings → "Replay tour": clears the tour outcome so the tour starts on the next app page. */
export const replayTour = protectedProcedure.mutation(({ ctx }) =>
  userProfileService.replayTour(ctx.user.id),
)
