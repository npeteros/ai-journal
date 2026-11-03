import { v1Router } from '@/src/server/api/routers/v1'
import { createTRPCRouter } from '../init'

export const appRouter = createTRPCRouter({
  v1: v1Router,
})

export type AppRouter = typeof appRouter
