import { isMainThread } from 'node:worker_threads'
import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { DuckDBStore } from '@mastra/duckdb'
import { MastraCompositeStore, type StorageDomains } from '@mastra/core/storage'
import { entryAnalysisAgent } from './agents/entry-analysis-agent'
import { entryTitleAgent } from './agents/entry-title-agent'
import { journalCompanionAgent } from './agents/journal-companion-agent'
import {
  answerRelevancyScorer,
  entryTitleFormatScorer,
  entryTitleInjectionScorer,
  entryTitleQualityScorer,
  journalCitationScorer,
  journalClinicalBoundaryScorer,
  journalGroundednessScorer,
  journalResponsePresenceScorer,
  journalToneScorer,
  journalUnknownScorer,
  toxicityScorer,
} from './scorers'
import { logger, observability } from './observability'
import { getEntryTool } from './tools/get-entry-tool'
import { searchEntriesTool } from './tools/search-entries-tool'
import { entryAnalysisWorkflow } from './workflows/entry-analysis-workflow'

const globalForDuckDB = globalThis as unknown as {
  duckDBObservability?: Promise<StorageDomains['observability']>
}

const isDev = process.env.NODE_ENV !== 'production'
const isNextWorker =
  !isMainThread || /[\\/]jest-worker[\\/]processChild\.js$/.test(process.argv[1] ?? '')

// Observability (tracing) is dev-only: traces go to mastra.duckdb for Studio.
// Production and `next build` omit it, so Mastra falls back to NoOpObservability
// and never opens DuckDB.
async function openObservabilityStore(): Promise<StorageDomains['observability']> {
  if (!isNextWorker) {
    const fileStore = new DuckDBStore()
    try {
      // Opens the file eagerly so a lock conflict surfaces here, not on the first trace.
      await fileStore.observability.init()
      return fileStore.observability
    } catch (error) {
      await fileStore.close()
      logger.warn('mastra.duckdb unavailable; this process keeps traces in memory', {
        procId: process.pid,
        parentProcId: process.ppid,
        entry: process.argv[1],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return new DuckDBStore({ path: ':memory:' }).observability
}

if (isDev) globalForDuckDB.duckDBObservability ??= openObservabilityStore()
const observabilityStore = isDev ? await globalForDuckDB.duckDBObservability : undefined

export const mastra = new Mastra({
  agents: { journalCompanionAgent, entryTitleAgent, entryAnalysisAgent },
  tools: { searchEntriesTool, getEntryTool },
  workflows: { entryAnalysisWorkflow },
  scorers: {
    answerRelevancyScorer,
    toxicityScorer,
    journalGroundednessScorer,
    journalResponsePresenceScorer,
    journalCitationScorer,
    journalClinicalBoundaryScorer,
    journalUnknownScorer,
    journalToneScorer,
    entryTitleFormatScorer,
    entryTitleInjectionScorer,
    entryTitleQualityScorer,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      // Uses a hosted database when deployed (mastra env db create --kind turso),
      // and a local file during development.
      url: process.env.TURSO_DATABASE_URL ?? 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    domains: observabilityStore ? { observability: observabilityStore } : {},
  }),
  logger,
  ...(isDev && { observability }),
})
