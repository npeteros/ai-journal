import { protectedProcedure } from '@/src/server/trpc/init'
import { TourOutcomeSchema } from '../../schema'
import { userProfileService } from '../../services/UserProfileService'

/** Records that the tour was completed or dismissed so it doesn't start again. */
export const finishTour = protectedProcedure
  .input(TourOutcomeSchema)
  .mutation(({ ctx, input }) => userProfileService.finishTour(ctx.user.id, input.outcome))
