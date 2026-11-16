import { createTRPCRouter } from '@/src/server/trpc/init'
import { draftEntry } from './core/mutations/draft'

export const voiceRouter = createTRPCRouter({
  draft: draftEntry,
})
