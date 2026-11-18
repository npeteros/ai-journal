import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/src/server/trpc/routers/_app'
import { createTRPCContext } from '@/src/server/trpc/init'

// Personality generation has a three-minute model deadline; the five-minute lease retains a
// recovery margin if this route's deferred work is interrupted.
export const maxDuration = 300

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: ({ resHeaders }) => createTRPCContext({ headers: request.headers, resHeaders }),
  })

export { handler as GET, handler as POST }
