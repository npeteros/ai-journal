import { createStep, createWorkflow } from '@mastra/core/workflows'
import type { RequestContext } from '@mastra/core/request-context'
import { z } from 'zod'
import {
  PERSONALITY_MODEL,
  PersonalityProfileOutputSchema,
  buildPersonalityPrompt,
  personalityAgent,
} from '../agents/personality-agent'
import { isAiRateLimited } from '../guardrails/AiUsageProcessor'
import { aiUsageService } from '../guardrails/AiUsageService'
import { USER_ID_KEY } from '../guardrails/requestContext'
import {
  PERSONALITY_PROFILE_GENERATION_TIMEOUT_MS,
  personalityProfileService,
  type PersonalityMetadataSource,
  type PersonalityProfileGenerator,
  type PersonalityProfileStatus,
  type PersonalityTextSample,
} from '@/src/server/api/routers/v1/insights/services/PersonalityProfileService'

export const PERSONALITY_WORKFLOW_ID = 'personality-workflow'

const inputSchema = z.object({ claimedAt: z.date() })
const outputSchema = z.object({
  status: z.enum([
    'generated',
    'insufficient_entries',
    'insufficient_evidence',
    'rate_limited',
    'timed_out',
    'failed',
  ] satisfies PersonalityProfileStatus[]),
})

/** Calls the agent with a hard deadline and trace-wide content suppression for journal privacy. */
export async function generatePersonalityProfile(
  input: {
    userId: string
    metadataSources: PersonalityMetadataSource[]
    textSamples: PersonalityTextSample[]
  },
  requestContext: RequestContext,
): ReturnType<PersonalityProfileGenerator> {
  const result = await personalityAgent.generate(
    buildPersonalityPrompt(input.metadataSources, input.textSamples),
    {
      requestContext,
      structuredOutput: { schema: PersonalityProfileOutputSchema },
      modelSettings: {
        timeout: { totalMs: PERSONALITY_PROFILE_GENERATION_TIMEOUT_MS },
        maxRetries: 0,
      },
      tracingOptions: { hideInput: true, hideOutput: true, tags: ['sensitive-personality'] },
    },
  )
  const rateLimited = isAiRateLimited(result.tripwire)
  // The shared rolling-window guard exposes configuration, not an exact reset timestamp.
  const retryAfter = rateLimited
    ? new Date(Date.now() + aiUsageService.getConfig().windowSeconds * 1000)
    : undefined
  return { output: result.object, rateLimited, retryAfter }
}

export const generatePersonalityProfileStep = createStep({
  id: 'generate-personality-profile',
  description: 'Generates and stores a user-scoped Big Five personality profile',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, requestContext }) => {
    const userId = requestContext.get(USER_ID_KEY)
    if (typeof userId !== 'string') {
      throw new Error('Personality workflow requires a user RequestContext')
    }

    const status = await personalityProfileService.generateClaimedProfile(
      userId,
      inputData.claimedAt,
      PERSONALITY_MODEL,
      (input) => generatePersonalityProfile(input, requestContext),
    )
    return { status }
  },
})

export const personalityWorkflow = createWorkflow({
  id: PERSONALITY_WORKFLOW_ID,
  description: 'Generates a stored, evidence-grounded Big Five personality profile',
  inputSchema,
  outputSchema,
})
  .then(generatePersonalityProfileStep)
  .commit()
