// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnySpan } from '@mastra/core/observability'
import { ContentRedactionProcessor } from '../observability'

function agentRunSpan() {
  return {
    input: 'What is the weather in Berlin?',
    output: 'Sunny, 21°C',
    attributes: {
      prompt: 'What is the weather in Berlin?',
      instructions: 'You are a helpful weather assistant.',
      maxSteps: 5,
    },
  } as unknown as AnySpan
}

describe('ContentRedactionProcessor', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('strips input, output, prompt and instructions but keeps other attributes', () => {
    const span = new ContentRedactionProcessor().process(agentRunSpan())

    expect(span?.input).toBeUndefined()
    expect(span?.output).toBeUndefined()
    expect(span?.attributes).toEqual({ prompt: undefined, instructions: undefined, maxSteps: 5 })
  })

  it('leaves content in place when AI_LOG_CONTENT=true', () => {
    vi.stubEnv('AI_LOG_CONTENT', 'true')

    const span = new ContentRedactionProcessor().process(agentRunSpan())

    expect(span).toEqual(agentRunSpan())
  })
})
