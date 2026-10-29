import { z } from 'zod'
import { baseProcedure, createTRPCRouter } from '../init'

//Subject to change, this is just an example prompt for the AI to respond to. ^_^
export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => ({ greeting: `hello ${input.text}` })),
})

export type AppRouter = typeof appRouter
