import { createTRPCRouter } from '@/src/server/trpc/init'
import { createEntry } from './core/mutations/create'
import { deleteEntry } from './core/mutations/delete'
import { updateEntry } from './core/mutations/update'
import { findMany } from './core/queries/findMany'
import { findOne } from './core/queries/findOne'

export const entryRouter = createTRPCRouter({
  findMany,
  findOne,
  create: createEntry,
  update: updateEntry,
  delete: deleteEntry,
})
