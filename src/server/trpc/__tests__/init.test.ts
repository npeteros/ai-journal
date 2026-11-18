// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { auth } from '@/src/server/auth/auth'
import {
  createCallerFactory,
  createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
  type TRPCContext,
} from '../init'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/server/auth/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

const getSession = vi.mocked(auth.api.getSession)

const validSession = {
  session: { id: 'session-1', userId: 'user-1' },
  user: { id: 'user-1', email: 'jaden@example.com', name: 'Jaden' },
} as unknown as NonNullable<SessionResult>

const testRouter = createTRPCRouter({
  whoAmI: protectedProcedure.query(({ ctx }) => {
    expectTypeOf(ctx.user.id).toEqualTypeOf<string>()
    expectTypeOf(ctx.session.userId).toEqualTypeOf<string>()
    return ctx.user.id
  }),
  touch: protectedProcedure.mutation(({ ctx }) => ctx.user.id),
})

const createCaller = createCallerFactory(testRouter)

async function callerFor(session: SessionResult) {
  getSession.mockResolvedValueOnce(session)
  const ctx: TRPCContext = await createTRPCContext({ headers: new Headers() })
  return createCaller(ctx)
}

describe('createTRPCContext', () => {
  beforeEach(() => getSession.mockReset())

  it('loads the session from the request headers', async () => {
    getSession.mockResolvedValueOnce(validSession)
    const headers = new Headers({ cookie: 'better-auth.session_token=abc' })

    const ctx = await createTRPCContext({ headers })

    expect(getSession).toHaveBeenCalledWith({ headers })
    expect(ctx).toEqual({ headers, session: validSession.session, user: validSession.user })
  })

  it('returns null session and user when unauthenticated', async () => {
    getSession.mockResolvedValueOnce(null)

    const ctx = await createTRPCContext({ headers: new Headers() })

    expect(ctx.session).toBeNull()
    expect(ctx.user).toBeNull()
  })

  it('forwards refreshed session cookies to the response when given response headers', async () => {
    const authHeaders = new Headers()
    authHeaders.append('set-cookie', 'better-auth.session_data=fresh; Path=/; HttpOnly')
    getSession.mockResolvedValueOnce({ headers: authHeaders, response: validSession } as never)
    const headers = new Headers({ cookie: 'better-auth.session_token=abc' })
    const resHeaders = new Headers()

    const ctx = await createTRPCContext({ headers, resHeaders })

    expect(getSession).toHaveBeenCalledWith({ headers, returnHeaders: true })
    expect(resHeaders.getSetCookie()).toEqual(['better-auth.session_data=fresh; Path=/; HttpOnly'])
    expect(ctx).toEqual({ headers, session: validSession.session, user: validSession.user })
  })

  it('reuses a provided session lookup instead of querying again', async () => {
    const headers = new Headers()

    const ctx = await createTRPCContext({ headers, getSession: async () => validSession })

    expect(getSession).not.toHaveBeenCalled()
    expect(ctx).toEqual({ headers, session: validSession.session, user: validSession.user })
  })
})

describe('protectedProcedure', () => {
  beforeEach(() => getSession.mockReset())

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = await callerFor(null)

    const error = await caller.whoAmI().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })

  it('passes a non-null user to the procedure with a valid session', async () => {
    const caller = await callerFor(validSession)

    await expect(caller.whoAmI()).resolves.toBe('user-1')
  })

  it('does not look the session up again for a query', async () => {
    const caller = await callerFor(validSession)

    await caller.whoAmI()

    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('re-checks the session without the cookie cache for a mutation', async () => {
    const caller = await callerFor(validSession)
    getSession.mockResolvedValueOnce(validSession)

    await expect(caller.touch()).resolves.toBe('user-1')
    expect(getSession).toHaveBeenLastCalledWith({
      headers: expect.any(Headers),
      query: { disableCookieCache: true },
    })
  })

  it('rejects a mutation from a session revoked since the cookie was cached', async () => {
    const caller = await callerFor(validSession)
    getSession.mockResolvedValueOnce(null)

    const error = await caller.touch().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })

  it('rejects a mutation from a user deleted since the cookie was cached', async () => {
    const caller = await callerFor(validSession)
    getSession.mockResolvedValueOnce({
      ...validSession,
      user: { ...validSession.user, deletedAt: new Date() },
    })

    const error = await caller.touch().catch((e: unknown) => e)

    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })
})
