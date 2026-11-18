// @vitest-environment node
import { RequestContext } from '@mastra/core/request-context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserRequestContext } from '../../guardrails/requestContext'

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  generateClaimedProfile: vi.fn(),
}))

vi.mock('../../agents/personality-agent', () => ({
  PERSONALITY_AGENT_ID: 'personality-agent',
  PERSONALITY_MODEL: 'openai/gpt-5-mini',
  PersonalityProfileOutputSchema: {},
  buildPersonalityPrompt: vi.fn(() => 'bounded personality prompt'),
  personalityAgent: { generate: mocks.generate },
}))
vi.mock('@/src/server/api/routers/v1/insights/services/PersonalityProfileService', () => ({
  PERSONALITY_PROFILE_GENERATION_TIMEOUT_MS: 180_000,
  personalityProfileService: { generateClaimedProfile: mocks.generateClaimedProfile },
}))

import {
  PERSONALITY_WORKFLOW_ID,
  generatePersonalityProfile,
  generatePersonalityProfileStep,
  personalityWorkflow,
} from '../personality-workflow'

const claimedAt = new Date('2026-11-17T12:00:00.000Z')
type StepArgs = Parameters<typeof generatePersonalityProfileStep.execute>[0]

function runStep(requestContext: RequestContext) {
  return generatePersonalityProfileStep.execute({
    inputData: { claimedAt },
    requestContext,
  } as StepArgs)
}

describe('personality workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateClaimedProfile.mockResolvedValue('generated')
    mocks.generate.mockResolvedValue({ object: { traits: [] } })
  })

  it('is registered as the claimed personality generation workflow', () => {
    expect(personalityWorkflow.id).toBe(PERSONALITY_WORKFLOW_ID)
  })

  it('passes the authenticated user and exact claim timestamp to fenced generation', async () => {
    await expect(runStep(createUserRequestContext('user-1'))).resolves.toEqual({
      status: 'generated',
    })
    expect(mocks.generateClaimedProfile).toHaveBeenCalledWith(
      'user-1',
      claimedAt,
      'openai/gpt-5-mini',
      expect.any(Function),
    )
  })

  it('refuses to run without an authenticated user context', async () => {
    await expect(runStep(new RequestContext())).rejects.toThrow(
      'Personality workflow requires a user RequestContext',
    )
    expect(mocks.generateClaimedProfile).not.toHaveBeenCalled()
  })

  it('forwards the server request context to the agent with bounded, redacted execution settings', async () => {
    const requestContext = createUserRequestContext('user-1')
    mocks.generateClaimedProfile.mockImplementation(
      async (
        _userId: string,
        _claimedAt: Date,
        _model: string,
        generate: (input: {
          userId: string
          metadataSources: []
          textSamples: []
        }) => Promise<unknown>,
      ) => {
        await generate({ userId: 'user-1', metadataSources: [], textSamples: [] })
        return 'generated'
      },
    )

    await runStep(requestContext)

    expect(mocks.generate).toHaveBeenCalledWith(
      'bounded personality prompt',
      expect.objectContaining({
        requestContext,
        structuredOutput: { schema: expect.anything() },
        modelSettings: { timeout: { totalMs: 180_000 }, maxRetries: 0 },
        tracingOptions: {
          hideInput: true,
          hideOutput: true,
          tags: ['sensitive-personality'],
        },
      }),
    )
  })

  it('maps the AI usage tripwire to a rate-limited generator result', async () => {
    mocks.generate.mockResolvedValue({
      object: undefined,
      tripwire: { processorId: 'ai-usage', metadata: { code: 'TOO_MANY_REQUESTS' } },
    })

    await expect(
      generatePersonalityProfile(
        { userId: 'user-1', metadataSources: [], textSamples: [] },
        createUserRequestContext('user-1'),
      ),
    ).resolves.toMatchObject({ output: undefined, rateLimited: true, retryAfter: expect.any(Date) })
  })
})
