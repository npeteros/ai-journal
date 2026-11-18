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

function personalityChildSpan() {
  return {
    input: 'Sensitive journal entry',
    output: 'Sensitive personality reflection',
    inputPreview: 'Sensitive journal entry',
    outputPreview: 'Sensitive personality reflection',
    errorPreview: 'Sensitive model error',
    errorInfo: { message: 'Sensitive journal entry', stack: 'Sensitive stack trace' },
    attributes: {
      prompt: 'Sensitive journal entry',
      instructions: 'Sensitive personality instructions',
    },
    parent: { entityId: 'personality-agent' },
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

  it('keeps error details on other agents so failures stay diagnosable', () => {
    const errorInfo = { message: 'Provider returned 500' }
    const span = new ContentRedactionProcessor().process({
      ...agentRunSpan(),
      errorPreview: 'Provider returned 500',
      errorInfo,
    } as unknown as AnySpan)

    expect(span?.input).toBeUndefined()
    expect(span?.errorPreview).toBe('Provider returned 500')
    expect(span?.errorInfo).toBe(errorInfo)
  })

  it('leaves content in place when AI_LOG_CONTENT=true', () => {
    vi.stubEnv('AI_LOG_CONTENT', 'true')

    const span = new ContentRedactionProcessor().process(agentRunSpan())

    expect(span).toEqual(agentRunSpan())
  })

  it('always redacts personality-agent traces even when AI_LOG_CONTENT=true', () => {
    vi.stubEnv('AI_LOG_CONTENT', 'true')

    const span = new ContentRedactionProcessor().process(personalityChildSpan())

    expect(span?.input).toBeUndefined()
    expect(span?.output).toBeUndefined()
    expect(span?.inputPreview).toBeUndefined()
    expect(span?.outputPreview).toBeUndefined()
    expect(span?.errorPreview).toBeUndefined()
    expect(span?.errorInfo).toBeUndefined()
    expect(span?.attributes).toEqual({ prompt: undefined, instructions: undefined })
  })
})
