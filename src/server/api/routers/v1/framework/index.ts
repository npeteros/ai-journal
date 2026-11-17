import { createTRPCRouter } from '@/src/server/trpc/init'
import { complete } from './core/mutations/complete'
import { createFramework } from './core/mutations/create'
import { updateFramework } from './core/mutations/update'
import { findMany } from './core/queries/findMany'
import { findOneBySlug } from './core/queries/findOneBySlug'

export const frameworkRouter = createTRPCRouter({
  findMany,
  findOneBySlug,
  create: createFramework,
  update: updateFramework,
  complete,
})
