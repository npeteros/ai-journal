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
vi.mock('../agents/insights-agent', () => ({ insightsAgent: { id: 'insights-agent' } }))
vi.mock('../agents/personality-agent', () => ({ personalityAgent: { id: 'personality-agent' } }))
vi.mock('../agents/journal-companion-agent', () => ({
  journalCompanionAgent: { id: 'journal-companion-agent' },
}))
vi.mock('../agents/voice-companion-agent', () => ({
  voiceCompanionAgent: { id: 'voice-companion-agent' },
}))
vi.mock('../agents/voice-draft-agent', () => ({ voiceDraftAgent: { id: 'voice-draft-agent' } }))
vi.mock('../scorers', () => ({
  answerRelevancyScorer: {},
  toxicityScorer: {},
  journalGroundednessScorer: {},
  journalResponsePresenceScorer: {},
  journalCitationScorer: {},
  journalClinicalBoundaryScorer: {},
  journalUnknownScorer: {},
  journalToneScorer: {},
  entryTitleFormatScorer: {},
  entryTitleInjectionScorer: {},
  entryTitleQualityScorer: {},
  personalityResponseSafetyGate: {},
  personalityWordingSafetyScorer: {},
}))
vi.mock('../observability', () => ({ logger: { warn: vi.fn() }, observability: {} }))
vi.mock('../tools/get-entry-tool', () => ({ getEntryTool: { id: 'get-entry' } }))
vi.mock('../tools/search-entries-tool', () => ({ searchEntriesTool: { id: 'search-entries' } }))
vi.mock('../workflows/entry-analysis-workflow', () => ({
  entryAnalysisWorkflow: { id: 'entry-analysis-workflow' },
}))
vi.mock('../workflows/insights-workflow', () => ({
  insightsWorkflow: { id: 'insights-workflow' },
}))
vi.mock('../workflows/personality-workflow', () => ({
  personalityWorkflow: { id: 'personality-workflow' },
}))

await import('../index')

describe('Mastra registration', () => {
  it('registers the journal and insights AI resources without weather starter code', () => {
    expect(mocks.config).toMatchObject({
      agents: {
        journalCompanionAgent: { id: 'journal-companion-agent' },
        entryTitleAgent: { id: 'entry-title-agent' },
        entryAnalysisAgent: { id: 'entry-analysis-agent' },
        insightsAgent: { id: 'insights-agent' },
        personalityAgent: { id: 'personality-agent' },
        voiceCompanionAgent: { id: 'voice-companion-agent' },
        voiceDraftAgent: { id: 'voice-draft-agent' },
      },
      tools: {
        searchEntriesTool: { id: 'search-entries' },
        getEntryTool: { id: 'get-entry' },
      },
      scorers: {
        journalGroundednessScorer: {},
        journalResponsePresenceScorer: {},
        journalCitationScorer: {},
        journalClinicalBoundaryScorer: {},
        journalUnknownScorer: {},
        journalToneScorer: {},
        entryTitleFormatScorer: {},
        entryTitleInjectionScorer: {},
        entryTitleQualityScorer: {},
        personalityResponseSafetyGate: {},
        personalityWordingSafetyScorer: {},
      },
    })
    expect(mocks.config).toHaveProperty('workflows', {
      entryAnalysisWorkflow: { id: 'entry-analysis-workflow' },
      insightsWorkflow: { id: 'insights-workflow' },
      personalityWorkflow: { id: 'personality-workflow' },
    })
  })

  it('passes Mastra storage in dev', () => {
    expect(mocks.config).toHaveProperty('storage')
  })

  it('configures no Mastra storage and loads no native store packages in production', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.doMock('@mastra/duckdb', () => {
      throw new Error('libduckdb.so: cannot open shared object file')
    })
    vi.doMock('@mastra/libsql', () => {
      throw new Error('Unable to open connection to local database ./mastra.db')
    })
    try {
      await expect(import('../index')).resolves.toHaveProperty('mastra')
      expect(mocks.config).not.toHaveProperty('storage')
      expect(mocks.config).not.toHaveProperty('observability')
    } finally {
      vi.doUnmock('@mastra/duckdb')
      vi.doUnmock('@mastra/libsql')
      vi.unstubAllEnvs()
    }
  })
})
