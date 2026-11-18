import 'server-only'

import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { headers } from 'next/headers'
import { cache } from 'react'
import { getServerSession } from '@/src/server/auth/session'
import { createTRPCContext } from './init'
import { makeQueryClient } from './query-client'
import { appRouter } from './routers/_app'

export const getQueryClient = cache(makeQueryClient)

// One context per request, shared by every RSC call. It reuses the session the layout and pages
// already looked up through `getServerSession`, so a render queries it once.
const createContext = cache(async () =>
  createTRPCContext({ headers: await headers(), getSession: getServerSession }),
)

export const trpc = createTRPCOptionsProxy({
  ctx: createContext,
  router: appRouter,
  queryClient: getQueryClient,
})
