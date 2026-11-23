import { createTRPCRouter } from '@/src/server/trpc/init'
import { companionQuestion } from './core/mutations/companionQuestion'
import { createEntry } from './core/mutations/create'
import { deleteEntry } from './core/mutations/delete'
import { updateEntry } from './core/mutations/update'
import { findMany } from './core/queries/findMany'
import { findOne } from './core/queries/findOne'
import { stats } from './core/queries/getStats'
import { weekMoods } from './core/queries/weekMoods'

export const entryRouter = createTRPCRouter({
  findMany,
  findOne,
  stats,
  weekMoods,
  create: createEntry,
  update: updateEntry,
  delete: deleteEntry,
  companionQuestion,
})
