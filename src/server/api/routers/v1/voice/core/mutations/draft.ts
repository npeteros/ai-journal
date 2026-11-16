import { protectedProcedure } from '@/src/server/trpc/init'
import { VoiceDraftSchema } from '../../schema'
import { voiceDraftService } from '../../services/VoiceDraftService'

/** Drafts an entry from a voice (or typed) journaling conversation. Nothing is saved here. */
export const draftEntry = protectedProcedure
  .input(VoiceDraftSchema)
  .mutation(({ ctx, input }) =>
    voiceDraftService.draft({ userId: ctx.user.id, turns: input.turns }),
  )
