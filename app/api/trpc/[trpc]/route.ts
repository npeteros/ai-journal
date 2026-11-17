import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/src/server/trpc/routers/_app'
import { createTRPCContext } from '@/src/server/trpc/init'

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: ({ resHeaders }) => createTRPCContext({ headers: request.headers, resHeaders }),
  })

export { handler as GET, handler as POST }
