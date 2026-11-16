import { TRPCError } from '@trpc/server'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { createEntryForUser } from '../../../entry/core/mutations/create'
import { EntryCreateSchema } from '../../../entry/schema'
import { FrameworkCompleteSchema, FrameworkPromptsSchema } from '../../schema'
import { frameworkWhereForUser } from '../queries/shared'

/** Finishing a framework saves a normal journal entry with `frameworkId` set. */
export const complete = protectedProcedure
  .input(FrameworkCompleteSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id
    const framework = await prisma.framework.findFirst({
      where: { ...frameworkWhereForUser(userId), id: input.frameworkId },
      select: { id: true, title: true, prompts: true },
    })
    if (!framework) throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })

    const prompts = FrameworkPromptsSchema.parse(framework.prompts)
    if (input.answers.length !== prompts.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'One answer is needed per prompt.' })
    }

    // Each answered prompt becomes a heading followed by its answer. Empty answers are skipped.
    const body = prompts
      .map((p, i) => ({ heading: p.prompt, answer: input.answers[i].trim() }))
      .filter((section) => section.answer.length > 0)
      .map((section) => `## ${section.heading}\n\n${section.answer}`)
      .join('\n\n')

    // Run the same validation as entry.create, so the body length cap and trimming still apply.
    const entryInput = EntryCreateSchema.safeParse({
      title: framework.title,
      body,
      timeZone: input.timeZone,
    })
    if (!entryInput.success) {
      // Same JSON-array message shape as an input validation error, so the client can explain it.
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: JSON.stringify(entryInput.error.issues),
        cause: entryInput.error,
      })
    }

    const entry = await createEntryForUser(userId, entryInput.data, { frameworkId: framework.id })
    return { entryId: entry.id }
  })
