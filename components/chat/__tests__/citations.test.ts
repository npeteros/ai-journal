import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { collectEntryRefs, splitCitations } from '../citations'

const monday = { id: 'e1', title: 'Monday blues', date: '2026-11-02' }
const sunday = { id: 'e2', title: 'Quiet Sunday', date: '2026-11-08' }

const assistantWithTools = {
  id: 'a1',
  role: 'assistant',
  parts: [
    {
      type: 'tool-searchEntriesTool',
      toolCallId: 't1',
      state: 'output-available',
      input: { keyword: 'work' },
      output: { entries: [{ ...monday, excerpt: '...' }] },
    },
    {
      type: 'tool-getEntryTool',
      toolCallId: 't2',
      state: 'output-available',
      input: { id: 'e2' },
      output: { entry: { ...sunday, body: '...' } },
    },
    {
      type: 'tool-getEntryTool',
      toolCallId: 't3',
      state: 'input-available',
      input: { id: 'e3' },
    },
    { type: 'text', text: 'Hello' },
  ],
} as unknown as UIMessage

describe('collectEntryRefs', () => {
  it('collects entries from completed search and get-entry tool calls', () => {
    expect(collectEntryRefs([assistantWithTools])).toEqual([monday, sunday])
  })
})

describe('splitCitations', () => {
  const refs = [monday, sunday]

  it('turns known citations into entry segments', () => {
    expect(splitCitations('Work was hard [2026-11-02 - Monday blues], then rest.', refs)).toEqual([
      { type: 'text', text: 'Work was hard ' },
      { type: 'cite', entry: monday },
      { type: 'text', text: ', then rest.' },
    ])
  })

  it('matches titles loosely and tolerates other dashes', () => {
    expect(splitCitations('[2026-11-08 — quiet  sunday]', refs)).toEqual([
      { type: 'cite', entry: sunday },
    ])
  })

  it('falls back to the only entry on that date', () => {
    expect(splitCitations('[2026-11-02 - Mondays]', refs)).toEqual([
      { type: 'cite', entry: monday },
    ])
  })

  it('leaves unknown citations as plain text', () => {
    const text = 'See [2025-01-01 - Made up] for more.'
    expect(splitCitations(text, refs)).toEqual([{ type: 'text', text }])
  })
})
