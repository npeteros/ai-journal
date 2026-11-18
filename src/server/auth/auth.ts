import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from '@/src/lib/prisma'
import { assertAccountNotDeleted } from './deleted-account'

/**
 * Preview deployments are served from their own hostnames (the per-deployment URL and the branch
 * alias), not `BETTER_AUTH_URL`, so better-auth would reject their sign-in requests as
 * INVALID_ORIGIN. Trust exactly those two hostnames, and only on previews.
 */
export function previewOrigins(): string[] {
  if (process.env.VERCEL_ENV !== 'preview') return []
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter((host): host is string => !!host)
    .map((host) => `https://${host}`)
}

export const auth = betterAuth({
  trustedOrigins: previewOrigins(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // Soft delete marker (see `v1.account.delete`). Never settable from a request.
      deletedAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Runs after the password has been checked, so it can't be used to probe which emails
        // belong to deleted accounts.
        before: async (session) => {
          await assertAccountNotDeleted(session.userId)
        },
      },
    },
  },
  session: {
    // Keeps a signed copy of the session in a cookie, so most requests skip the session and user
    // queries. Trade-off: a revoked session can keep reading until its cached copy expires
    // (1 min); tRPC mutations skip the cache, so it can't write. Server-side `getSession` calls
    // can't set cookies, so the tRPC route forwards the refreshed cookie (see
    // `src/server/trpc/init.ts`).
    cookieCache: { enabled: true, maxAge: 60 },
  },
})
