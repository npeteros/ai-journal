import { createTRPCRouter } from '@/src/server/trpc/init'
import { deleteTag } from './core/mutations/delete'
import { updateTag } from './core/mutations/update'
import { findManyTags } from './core/queries/find'

export const tagRouter = createTRPCRouter({
  findMany: findManyTags,
  update: updateTag,
  delete: deleteTag,
})
