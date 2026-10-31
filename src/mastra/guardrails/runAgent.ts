import type { Agent, AgentExecutionOptionsBase } from '@mastra/core/agent'
import { RequestContext } from '@mastra/core/request-context'
import type { LanguageModelUsage } from '@mastra/core/stream'
import { aiUsageService, type AiUsageService } from './AiUsageService'

export type GuardedExecutionOptions = Pick<
  AgentExecutionOptionsBase<undefined>,
  'requestContext' | 'tracingOptions' | 'onFinish' | 'onError' | 'onAbort'
>

type GuardAgentCallInput = {
  agent: Agent
  userId: string
  service?: AiUsageService
}

/**
 * Single entry point for user-triggered agent calls. Enforces the per-user rate
 * limit before the model is called, tags the trace with the user ID, and returns
 * execution options that record an AiUsageLog row once the call finishes or fails.
 *
 * Spread the result into `agent.generate()` / `agent.stream()` / `handleChatStream()` params.
 */
export async function guardAgentCall({
  agent,
  userId,
  service = aiUsageService,
}: GuardAgentCallInput): Promise<GuardedExecutionOptions> {
  await service.assertWithinLimit(userId)

  const requestContext = new RequestContext()
  requestContext.set('userId', userId)

  const configuredModel = await agent.getModel({ requestContext })
  const defaultModelId = `${configuredModel.provider}/${configuredModel.modelId}`

  const startedAt = Date.now()
  let recorded = false

  const record = (success: boolean, usage?: LanguageModelUsage, modelId = defaultModelId) => {
    // onError/onAbort can follow onFinish; only the first outcome is recorded.
    if (recorded) return
    recorded = true
    void service.record({
      userId,
      agent: agent.id,
      model: modelId,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      success,
    })
  }

  return {
    requestContext,
    tracingOptions: { metadata: { userId } },
    onFinish: (event) => {
      const modelId =
        event.model?.provider && event.model.modelId
          ? `${event.model.provider}/${event.model.modelId}`
          : defaultModelId
      record(!event.error, event.totalUsage, modelId)
    },
    onError: () => record(false),
    onAbort: () => record(false),
  }
}
