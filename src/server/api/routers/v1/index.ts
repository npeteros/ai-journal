import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'
import { complete } from './framework/complete'
import { findMany } from './framework/findMany'
import { findOneBySlug } from './framework/findOneBySlug'
import { insightsRouter } from './insights'
import { tagRouter } from './tag'
import { voiceRouter } from './voice'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
  framework: createTRPCRouter({ findMany, findOneBySlug, complete }),
  insights: insightsRouter,
  tag: tagRouter,
  voice: voiceRouter,
})
