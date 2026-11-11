import { createTRPCRouter } from '@/src/server/trpc/init'
import { overview } from './core/queries/overview'

export const insightsRouter = createTRPCRouter({
  overview,
})
