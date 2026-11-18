import { createTRPCRouter } from '@/src/server/trpc/init'
import { deleteAccount } from './core/mutations/delete'

export const accountRouter = createTRPCRouter({
  delete: deleteAccount,
})
