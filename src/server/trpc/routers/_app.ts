import { z } from 'zod'
import { baseProcedure, createTRPCRouter } from '../init'

//Test router
export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => ({ greeting: `hello ${input.text}` })),
})

export type AppRouter = typeof appRouter
