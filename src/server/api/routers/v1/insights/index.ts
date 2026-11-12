import { createTRPCRouter } from '@/src/server/trpc/init'
import { refresh } from './core/mutations/refresh'
import { overview } from './core/queries/overview'
import { report } from './core/queries/report'

export const insightsRouter = createTRPCRouter({
  overview,
  report,
  refresh,
})
