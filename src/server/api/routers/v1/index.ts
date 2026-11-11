import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'
import { insightsRouter } from './insights'
import { tagRouter } from './tag'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
  insights: insightsRouter,
  tag: tagRouter,
})
