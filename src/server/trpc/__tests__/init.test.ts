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
})
