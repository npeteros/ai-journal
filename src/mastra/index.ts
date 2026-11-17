import { isMainThread } from 'node:worker_threads'
import { Mastra } from '@mastra/core/mastra'
import type { MastraCompositeStore, StorageDomains } from '@mastra/core/storage'
import { entryAnalysisAgent } from './agents/entry-analysis-agent'
import { entryTitleAgent } from './agents/entry-title-agent'
import { insightsAgent } from './agents/insights-agent'
import { journalCompanionAgent } from './agents/journal-companion-agent'
import { voiceCompanionAgent } from './agents/voice-companion-agent'
import { voiceDraftAgent } from './agents/voice-draft-agent'
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
import { insightsWorkflow } from './workflows/insights-workflow'

const globalForMastraStorage = globalThis as unknown as {
  mastraDevStorage?: Promise<MastraCompositeStore>
}

const isDev = process.env.NODE_ENV !== 'production'
const isNextWorker =
  !isMainThread || /[\\/]jest-worker[\\/]processChild\.js$/.test(process.argv[1] ?? '')

// Traces go to mastra.duckdb for Studio. Falls back to an in-memory store when
// another process holds the file lock.
async function openObservabilityStore(): Promise<StorageDomains['observability']> {
  const { DuckDBStore } = await import('@mastra/duckdb')
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

// Mastra storage is dev-only
async function openDevStorage(): Promise<MastraCompositeStore> {
  const [{ MastraCompositeStore }, { LibSQLStore }] = await Promise.all([
    import('@mastra/core/storage'),
    import('@mastra/libsql'),
  ])
  return new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' }),
    domains: { observability: await openObservabilityStore() },
  })
}

if (isDev) globalForMastraStorage.mastraDevStorage ??= openDevStorage()
const storage = isDev ? await globalForMastraStorage.mastraDevStorage : undefined

export const mastra = new Mastra({
  agents: {
    journalCompanionAgent,
    entryTitleAgent,
    entryAnalysisAgent,
    insightsAgent,
    voiceCompanionAgent,
    voiceDraftAgent,
  },
  tools: { searchEntriesTool, getEntryTool },
  workflows: { entryAnalysisWorkflow, insightsWorkflow },
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
  ...(storage && { storage }),
  logger,
  ...(isDev && { observability }),
})
