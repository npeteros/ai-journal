import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'
import { frameworkRouter } from './framework'
import { insightsRouter } from './insights'
import { tagRouter } from './tag'
import { voiceRouter } from './voice'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
  framework: frameworkRouter,
  insights: insightsRouter,
  tag: tagRouter,
  voice: voiceRouter,
})
