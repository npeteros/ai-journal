import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { findOneEntryForUser } from '@/src/server/api/routers/v1/entry/core/queries/shared'
import { USER_ID_KEY } from '../guardrails/requestContext'

export const getEntryTool = createTool({
  id: 'get-entry',
  description: 'Get the full text of one journal entry belonging to the authenticated user.',
  inputSchema: z.object({ id: z.uuid() }),
  outputSchema: z.object({
    entry: z
      .object({
        id: z.string(),
        title: z.string(),
        date: z.string(),
        body: z.string(),
      })
      .nullable(),
  }),
  execute: async ({ id }, { requestContext }) => {
    const userId = requestContext?.get(USER_ID_KEY)
    if (typeof userId !== 'string' || userId.length === 0) return { entry: null }

    const entry = await findOneEntryForUser(userId, id)
    if (!entry) return { entry: null }

    return {
      entry: {
        id: entry.id,
        title: entry.title,
        date: entry.entryDate.toISOString().slice(0, 10),
        body: entry.body,
      },
    }
  },
})
