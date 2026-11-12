import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { insightsWorkflow } from '@/src/mastra/workflows/insights-workflow'
import { protectedProcedure } from '@/src/server/trpc/init'

export const refresh = protectedProcedure.mutation(async ({ ctx }) => {
  const run = await insightsWorkflow.createRun()
  const result = await run.start({
    inputData: {},
    requestContext: createUserRequestContext(ctx.user.id),
  })

  return result.status === 'success' ? result.result : { status: 'failed' as const }
})
