import { TRPCError } from '@trpc/server'
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
  Processor,
} from '@mastra/core/processors'
import { aiUsageService, type AiUsageService } from './AiUsageService'
import { USER_ID_KEY } from './requestContext'

export const AI_USAGE_PROCESSOR_ID = 'ai-usage'

const RATE_LIMITED_CODE = 'TOO_MANY_REQUESTS'
const RUN_STATE_KEY = 'run'
const FAILED_FINISH_REASONS = new Set(['error', 'aborted'])

export type AiUsageTripwireMetadata = { code: typeof RATE_LIMITED_CODE }

/** Minimal shape of the tripwire Mastra reports on a result or a `data-tripwire` chunk. */
export type TripwireInfo = {
  reason?: string
  processorId?: string
  metadata?: unknown
}

/** Per-request bookkeeping kept in processor state; a class so reads can narrow with instanceof. */
class UsageRun {
  inputTokens = 0
  outputTokens = 0
  finalized = false

  constructor(
    readonly usageId: string,
    readonly startedAt: number,
    public model: string,
  ) {}
}

function getRun(state: Record<string, unknown>): UsageRun | undefined {
  const run = state[RUN_STATE_KEY]
  return run instanceof UsageRun ? run : undefined
}

/**
 * Enforces the per-user AI rate limit and records an AiUsageLog row for every agent call,
 * however the agent is invoked (route, tRPC, workflow step, eval). Add it to every agent's
 * `inputProcessors` and `outputProcessors`; both phases share one per-request state.
 *
 * - processInput reserves the usage row before the model is called, aborting (tripwire) when the
 *   user is over the limit. Calls with no `userId` in the RequestContext are logged as system calls.
 * - processInputStep records the model actually used.
 * - processOutputStep keeps a running token total, so failed and aborted calls still report spend.
 * - processOutputResult fills in the row once the run finishes, errors or is aborted.
 *
 * If the process dies mid-call the reserved row stays as a failed call with no tokens.
 */
export class AiUsageProcessor implements Processor<typeof AI_USAGE_PROCESSOR_ID> {
  readonly id = AI_USAGE_PROCESSOR_ID
  readonly name = 'AI Usage'

  constructor(private readonly service: AiUsageService = aiUsageService) {}

  async processInput({
    agent,
    requestContext,
    state,
    abort,
    messages,
  }: ProcessInputArgs<AiUsageTripwireMetadata>) {
    const rawUserId = requestContext?.get(USER_ID_KEY)
    const userId = typeof rawUserId === 'string' ? rawUserId : null

    // The row needs a model up front; processInputStep replaces it with the one actually used.
    const configuredModel = agent ? await agent.getModel({ requestContext }) : undefined
    const model = configuredModel
      ? `${configuredModel.provider}/${configuredModel.modelId}`
      : 'unknown'

    try {
      const usageId = await this.service.reserve({
        userId,
        agent: agent?.id ?? 'unknown',
        model,
      })
      state[RUN_STATE_KEY] = new UsageRun(usageId, Date.now(), model)
    } catch (error) {
      if (error instanceof TRPCError && error.code === RATE_LIMITED_CODE) {
        abort(error.message, { metadata: { code: RATE_LIMITED_CODE } })
      }
      throw error
    }

    return messages
  }

  processInputStep({ model, state }: ProcessInputStepArgs<AiUsageTripwireMetadata>) {
    const run = getRun(state)
    if (run) run.model = `${model.provider}/${model.modelId}`
  }

  processOutputStep({ usage, state, messages }: ProcessOutputStepArgs<AiUsageTripwireMetadata>) {
    const run = getRun(state)
    if (run) {
      run.inputTokens += usage?.inputTokens ?? 0
      run.outputTokens += usage?.outputTokens ?? 0
    }
    return messages
  }

  async processOutputResult({
    result,
    state,
    messages,
  }: ProcessOutputResultArgs<AiUsageTripwireMetadata>) {
    const run = getRun(state)
    // No run: this processor didn't reserve for this state (e.g. agent.network() message saving).
    if (!run || run.finalized) return messages
    run.finalized = true

    await this.service.finalize(run.usageId, {
      model: run.model,
      inputTokens: result.usage?.inputTokens ?? run.inputTokens,
      outputTokens: result.usage?.outputTokens ?? run.outputTokens,
      latencyMs: Date.now() - run.startedAt,
      success: !FAILED_FINISH_REASONS.has(result.finishReason),
    })

    return messages
  }
}

export const aiUsageProcessor = new AiUsageProcessor()

/** True when a tripwire came from AiUsageProcessor rejecting an over-limit call. */
export function isAiRateLimited(tripwire: TripwireInfo | undefined): boolean {
  if (tripwire?.processorId !== AI_USAGE_PROCESSOR_ID) return false
  const { metadata } = tripwire
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'code' in metadata &&
    metadata.code === RATE_LIMITED_CODE
  )
}

/**
 * For tRPC procedures: call after `agent.generate()` to turn an over-limit tripwire into
 * a TOO_MANY_REQUESTS error (the agent returns the tripwire on the result instead of throwing).
 */
export function assertNotRateLimited(result: { tripwire?: TripwireInfo }): void {
  if (isAiRateLimited(result.tripwire)) {
    throw new TRPCError({
      code: RATE_LIMITED_CODE,
      message: result.tripwire?.reason ?? 'AI rate limit exceeded',
    })
  }
}
