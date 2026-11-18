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

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.user || ctx.user.deletedAt) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  // Re-pass session/user so downstream procedures see them as non-null.
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.user } })
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
