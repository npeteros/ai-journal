import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { createEntryForUser } from '@/src/server/api/routers/v1/entry/core/mutations/create'

const promptsSchema = z.array(z.object({ prompt: z.string(), sample: z.string().optional() }))

const completeInput = z
  .object({
    frameworkId: z.string().uuid(),
    answers: z.array(z.string().max(10_000)).min(1).max(50), // one per prompt; empty allowed
    timeZone: z.string().min(1),
  })
  .refine((i) => i.answers.some((a) => a.trim().length > 0), {
    message: 'Answer at least one prompt.',
  })

// Finishing a framework saves a normal journal entry with frameworkId set.
export const complete = protectedProcedure.input(completeInput).mutation(async ({ ctx, input }) => {
  const userId = ctx.user.id
  const framework = await prisma.framework.findFirst({
    where: { id: input.frameworkId, deletedAt: null, OR: [{ userId: null }, { userId }] },
    select: { id: true, title: true, prompts: true },
  })
  if (!framework) throw new TRPCError({ code: 'NOT_FOUND', message: 'Framework not found.' })

  const prompts = promptsSchema.parse(framework.prompts)
  if (input.answers.length !== prompts.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One answer is needed per prompt.' })
  }

  // Each answered prompt becomes a heading followed by its answer. Empty answers are skipped.
  // ADAPT: use whatever format your entry body expects (markdown assumed here).
  const body = prompts
    .map((p, i) => ({ heading: p.prompt, answer: input.answers[i]!.trim() }))
    .filter((x) => x.answer)
    .map((x) => `## ${x.heading}\n\n${x.answer}`)
    .join('\n\n')

  // Same create path as entry.create (title, entry date, tags, analysis scheduling).
  const entry = await createEntryForUser(
    userId,
    { title: framework.title, body, timeZone: input.timeZone, tags: [] },
    { frameworkId: framework.id },
  )

  return { entryId: entry.id }
})
