import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from '@/src/lib/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // Keeps a signed copy of the session in a cookie, so most requests skip the session and user
    // queries. Trade-off: a revoked session keeps working until its cached copy expires (5 min).
    // Server-side `getSession` calls can't set cookies, so the tRPC route forwards the refreshed
    // cookie (see `src/server/trpc/init.ts`).
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
})
