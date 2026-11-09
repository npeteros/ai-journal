import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { DuckDBStore } from '@mastra/duckdb'
import { MastraCompositeStore } from '@mastra/core/storage'
import { entryTitleAgent } from './agents/entry-title-agent'
import { journalCompanionAgent } from './agents/journal-companion-agent'
import { answerRelevancyScorer, toxicityScorer } from './scorers'
import { logger, observability } from './observability'
import { getEntryTool } from './tools/get-entry-tool'
import { searchEntriesTool } from './tools/search-entries-tool'

export const mastra = new Mastra({
  agents: { journalCompanionAgent, entryTitleAgent },
  tools: { searchEntriesTool, getEntryTool },
  scorers: { answerRelevancyScorer, toxicityScorer },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      // Uses a hosted database when deployed (mastra env db create --kind turso),
      // and a local file during development.
      url: process.env.TURSO_DATABASE_URL ?? 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  logger,
  observability,
})
