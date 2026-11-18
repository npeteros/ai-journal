import { createTRPCRouter } from '@/src/server/trpc/init'
import { refresh } from './core/mutations/refresh'
import { overview } from './core/queries/overview'
import { personality } from './core/queries/personality'
import { report } from './core/queries/report'
import { story } from './core/queries/story'

export const insightsRouter = createTRPCRouter({
  overview,
  personality,
  report,
  story,
  refresh,
})
