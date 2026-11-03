import { createTRPCRouter } from '@/src/server/trpc/init'
import { entryRouter } from './entry'

export const v1Router = createTRPCRouter({
  entry: entryRouter,
})
