import { createTRPCRouter } from '@/src/server/trpc/init'
import { createEntry } from './core/mutations/create'
import { deleteEntry } from './core/mutations/delete'
import { updateEntry } from './core/mutations/update'

export const entryRouter = createTRPCRouter({
  create: createEntry,
  update: updateEntry,
  delete: deleteEntry,
})
