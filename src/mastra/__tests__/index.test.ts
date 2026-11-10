// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ config: null as unknown }))

vi.mock('@mastra/core/mastra', () => ({
  Mastra: class {
    constructor(config: unknown) {
      mocks.config = config
    }
  },
}))
vi.mock('@mastra/libsql', () => ({ LibSQLStore: class {} }))
vi.mock('@mastra/duckdb', () => ({
  DuckDBStore: class {
    observability = { init: async () => {} }
    async close() {}
  },
}))
vi.mock('@mastra/core/storage', () => ({ MastraCompositeStore: class {} }))
vi.mock('../agents/entry-title-agent', () => ({ entryTitleAgent: { id: 'entry-title-agent' } }))
vi.mock('../agents/entry-analysis-agent', () => ({
  entryAnalysisAgent: { id: 'entry-analysis-agent' },
}))
vi.mock('../agents/journal-companion-agent', () => ({
  journalCompanionAgent: { id: 'journal-companion-agent' },
}))
vi.mock('../scorers', () => ({ answerRelevancyScorer: {}, toxicityScorer: {} }))
vi.mock('../observability', () => ({ logger: { warn: vi.fn() }, observability: {} }))
vi.mock('../tools/get-entry-tool', () => ({ getEntryTool: { id: 'get-entry' } }))
vi.mock('../tools/search-entries-tool', () => ({ searchEntriesTool: { id: 'search-entries' } }))

await import('../index')

describe('Mastra registration', () => {
  it('registers Jaden and both journal tools without weather starter code', () => {
    expect(mocks.config).toMatchObject({
      agents: {
        journalCompanionAgent: { id: 'journal-companion-agent' },
        entryTitleAgent: { id: 'entry-title-agent' },
        entryAnalysisAgent: { id: 'entry-analysis-agent' },
      },
      tools: {
        searchEntriesTool: { id: 'search-entries' },
        getEntryTool: { id: 'get-entry' },
      },
    })
    expect(mocks.config).not.toHaveProperty('workflows')
  })
})
