import { protectedProcedure } from '@/src/server/trpc/init'
import { EntryCompanionQuestionSchema } from '../../schema'
import { writingCompanionService } from '../../services/WritingCompanionService'

/**
 * One follow-up question from the writing companion for the entry being written. The rules in
 * src/lib/companion.ts are enforced by the service; refusals come back as a status, not an error.
 */
export const companionQuestion = protectedProcedure
  .input(EntryCompanionQuestionSchema)
  .mutation(({ ctx, input }) =>
    writingCompanionService.ask({
      userId: ctx.user.id,
      entryId: input.id,
      text: input.text,
      trigger: input.trigger,
    }),
  )
