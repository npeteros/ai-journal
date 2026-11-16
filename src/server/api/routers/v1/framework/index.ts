import { createTRPCRouter } from '@/src/server/trpc/init'
import { complete } from './core/mutations/complete'
import { findMany } from './core/queries/findMany'
import { findOneBySlug } from './core/queries/findOneBySlug'

export const frameworkRouter = createTRPCRouter({
  findMany,
  findOneBySlug,
  complete,
})
