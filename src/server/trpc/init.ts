import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@/src/server/auth/auth'

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

/** Looks up the session and copies any refreshed session cookies onto the response. */
async function getSessionForwardingCookies(headers: Headers, resHeaders: Headers) {
  const { headers: authHeaders, response } = await auth.api.getSession({
    headers,
    returnHeaders: true,
  })
  for (const cookie of authHeaders.getSetCookie()) resHeaders.append('set-cookie', cookie)
  return response
}

/**
 * - `getSession` lets server-side callers reuse a session already looked up for this request
 *   (see `src/server/trpc/server.tsx`) instead of querying it again.
 * - `resHeaders` (the HTTP route) receives the session cookie cache whenever better-auth renews
 *   it, which keeps the cache warm while the app is in use.
 */
export const createTRPCContext = async (opts: {
  headers: Headers
  resHeaders?: Headers
  getSession?: () => Promise<SessionResult>
}) => {
  const result = opts.getSession
    ? await opts.getSession()
    : opts.resHeaders
      ? await getSessionForwardingCookies(opts.headers, opts.resHeaders)
      : await auth.api.getSession({ headers: opts.headers })

  return {
    headers: opts.headers,
    session: result?.session ?? null,
    user: result?.user ?? null,
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create()

/**
 * Queries trust the session from the context, which may come from the cookie cache (up to a
 * minute old). Mutations look it up again without the cache, so a session that was signed out,
 * or whose account was deleted, can't change anything once it's gone from the database.
 */
const isAuthed = t.middleware(async ({ ctx, type, next }) => {
  const result =
    type === 'mutation' && ctx.session
      ? await auth.api.getSession({
          headers: ctx.headers,
          query: { disableCookieCache: true },
        })
      : { session: ctx.session, user: ctx.user }

  const session = result?.session
  const user = result?.user
  if (!session || !user || user.deletedAt) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  // Re-pass session/user so downstream procedures see them as non-null.
  return next({ ctx: { ...ctx, session, user } })
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
