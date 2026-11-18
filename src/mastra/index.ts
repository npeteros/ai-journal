import { isMainThread } from 'node:worker_threads'
import { Mastra } from '@mastra/core/mastra'
import type { MastraCompositeStore, StorageDomains } from '@mastra/core/storage'
import { entryAnalysisAgent } from './agents/entry-analysis-agent'
import { entryTitleAgent } from './agents/entry-title-agent'
import { insightsAgent } from './agents/insights-agent'
import { personalityAgent } from './agents/personality-agent'
import { journalCompanionAgent } from './agents/journal-companion-agent'
import { monthlyStoryAgent } from './agents/monthly-story-agent'
import { voiceCompanionAgent } from './agents/voice-companion-agent'
import { voiceDraftAgent } from './agents/voice-draft-agent'
import { logger, observability } from './observability'
import { getEntryTool } from './tools/get-entry-tool'
import { searchEntriesTool } from './tools/search-entries-tool'
import { entryAnalysisWorkflow } from './workflows/entry-analysis-workflow'
import { insightsWorkflow } from './workflows/insights-workflow'
import { personalityWorkflow } from './workflows/personality-workflow'

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

// Scorers serve evals and Studio only; no agent scores at runtime. Loading them lazily outside
// production keeps them (and @mastra/evals, a devDependency) off production cold starts.
async function loadDevScorers() {
  const s = await import('./scorers')
  return {
    answerRelevancyScorer: s.answerRelevancyScorer,
    toxicityScorer: s.toxicityScorer,
    journalGroundednessScorer: s.journalGroundednessScorer,
    journalResponsePresenceScorer: s.journalResponsePresenceScorer,
    journalCitationScorer: s.journalCitationScorer,
    journalClinicalBoundaryScorer: s.journalClinicalBoundaryScorer,
    journalUnknownScorer: s.journalUnknownScorer,
    journalToneScorer: s.journalToneScorer,
    entryTitleFormatScorer: s.entryTitleFormatScorer,
    entryTitleInjectionScorer: s.entryTitleInjectionScorer,
    entryTitleQualityScorer: s.entryTitleQualityScorer,
    personalityResponseSafetyGate: s.personalityResponseSafetyGate,
    personalityWordingSafetyScorer: s.personalityWordingSafetyScorer,
  }
}

const scorers = isDev ? await loadDevScorers() : undefined

export const mastra = new Mastra({
  agents: {
    journalCompanionAgent,
    entryTitleAgent,
    entryAnalysisAgent,
    insightsAgent,
    monthlyStoryAgent,
    personalityAgent,
    voiceCompanionAgent,
    voiceDraftAgent,
  },
  tools: { searchEntriesTool, getEntryTool },
  workflows: { entryAnalysisWorkflow, insightsWorkflow, personalityWorkflow },
  ...(scorers && { scorers }),
  ...(storage && { storage }),
  logger,
  ...(isDev && { observability }),
})
