import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'
import { complete } from './framework/complete'
import { createFramework } from './framework/create'
import { findMany } from './framework/findMany'
import { findOneBySlug } from './framework/findOneBySlug'
import { updateFramework } from './framework/update'
import { insightsRouter } from './insights'
import { tagRouter } from './tag'
import { voiceRouter } from './voice'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
  framework: createTRPCRouter({
    findMany,
    findOneBySlug,
    create: createFramework,
    update: updateFramework,
    complete,
  }),
  insights: insightsRouter,
  tag: tagRouter,
  voice: voiceRouter,
})
