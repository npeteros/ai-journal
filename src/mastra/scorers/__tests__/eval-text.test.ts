// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assistantText, inputText, normalizeEvaluationText } from '../eval-text'

describe('evaluation text extraction', () => {
  it('extracts visible assistant text while excluding tool calls and tool results', () => {
    const output = [
      {
        role: 'assistant',
        content: {
          parts: [
            { type: 'tool-call', toolName: 'searchEntriesTool', args: { keyword: 'private' } },
            { type: 'text', text: 'I could not find a relevant entry.' },
          ],
        },
      },
      {
        role: 'tool',
        content: { parts: [{ type: 'text', text: 'private tool result' }] },
      },
    ]

    expect(assistantText(output)).toBe('I could not find a relevant entry.')
  })

  it('extracts user text from multipart inputs and normalizes equivalent punctuation', () => {
    const input = {
      inputMessages: [
        {
          role: 'user',
          content: { parts: [{ type: 'text', text: 'What happened in my interview?' }] },
        },
      ],
    }

    expect(inputText(input)).toBe('What happened in my interview?')
    expect(normalizeEvaluationText('I can’t diagnose\u00a0this.')).toBe("I can't diagnose this.")
  })

  it('returns blank text when the final assistant message contains only tool calls', () => {
    const output = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'search-1',
                toolName: 'searchEntriesTool',
                state: 'result',
              },
            },
          ],
        },
      },
    ]

    expect(assistantText(output)).toBe('')
  })
})
