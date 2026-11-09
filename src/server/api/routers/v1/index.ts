import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'
import { tagRouter } from './tag'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
  tag: tagRouter,
})
