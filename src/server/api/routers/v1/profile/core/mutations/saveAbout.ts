import { protectedProcedure } from '@/src/server/trpc/init'
import { SaveAboutSchema } from '../../schema'
import { userProfileService } from '../../services/UserProfileService'

/** Saves the "Tell Jaden about you" answers (welcome card or Settings). Skipped questions clear. */
export const saveAbout = protectedProcedure
  .input(SaveAboutSchema)
  .mutation(({ ctx, input }) => userProfileService.saveAbout(ctx.user.id, input))
