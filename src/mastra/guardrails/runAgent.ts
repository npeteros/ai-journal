import type { Agent, AgentExecutionOptionsBase } from '@mastra/core/agent'
import { RequestContext } from '@mastra/core/request-context'
import type { LanguageModelUsage } from '@mastra/core/stream'
import { aiUsageService, type AiUsageService } from './AiUsageService'

export type GuardedExecutionOptions = Pick<
  AgentExecutionOptionsBase<undefined>,
  'requestContext' | 'onStepFinish' | 'onFinish' | 'onError' | 'onAbort'
>

type GuardAgentCallInput = {
  agent: Agent
  userId: string
  service?: AiUsageService
}

type TokenUsage = { inputTokens: number; outputTokens: number }

/**
 * Single entry point for user-triggered agent calls. Reserves an AiUsageLog row
 * (enforcing the per-user rate limit) before the model is called, tags the trace
 * with the user ID, and returns execution options that fill in the row once the
 * call finishes, fails or is aborted.
 *
 * Spread the result into `agent.generate()` / `agent.stream()` / `handleChatStream()` params.
 */
export async function guardAgentCall({
  agent,
  userId,
  service = aiUsageService,
}: GuardAgentCallInput): Promise<GuardedExecutionOptions> {
  // userId is attached to every trace via the observability requestContextKeys.
  const requestContext = new RequestContext()
  requestContext.set('userId', userId)

  // The reserved row needs a model up front; onFinish reports the one actually used.
  const configuredModel = await agent.getModel({ requestContext })
  const defaultModelId = `${configuredModel.provider}/${configuredModel.modelId}`

  const usageId = await service.reserve({ userId, agent: agent.id, model: defaultModelId })

  const startedAt = Date.now()
  // Running total from completed steps, so failed and aborted calls still report spent tokens.
  const stepUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
  let finalized = false

  const finalize = (success: boolean, usage: TokenUsage, model?: string) => {
    // onError/onAbort can follow onFinish; only the first outcome is recorded.
    if (finalized) return
    finalized = true
    void service.finalize(usageId, {
      model,
      ...usage,
      latencyMs: Date.now() - startedAt,
      success,
    })
  }

  const toTokenUsage = (usage: LanguageModelUsage): TokenUsage => ({
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  })

  return {
    requestContext,
    onStepFinish: (step) => {
      const usage = toTokenUsage(step.usage)
      stepUsage.inputTokens += usage.inputTokens
      stepUsage.outputTokens += usage.outputTokens
    },
    onFinish: (event) => {
      const model =
        event.model?.provider && event.model.modelId
          ? `${event.model.provider}/${event.model.modelId}`
          : undefined
      finalize(!event.error, toTokenUsage(event.totalUsage), model)
    },
    onError: () => finalize(false, stepUsage),
    onAbort: () => finalize(false, stepUsage),
  }
}
