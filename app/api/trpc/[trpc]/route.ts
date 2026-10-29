import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/trpc/routers/_app'
import { createTRPCContext } from '@/trpc/init'

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
  })

export { handler as GET, handler as POST }
