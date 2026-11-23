import { protectedProcedure } from '@/src/server/trpc/init'
import { userProfileService } from '../../services/UserProfileService'

/** The signed-in user's onboarding answers and which first-run step (if any) to show. */
export const get = protectedProcedure.query(({ ctx }) => userProfileService.get(ctx.user.id))
