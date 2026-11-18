// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auth } from '@/src/server/auth/auth'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { accountRouter } from '../index'

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
  verifyPassword: vi.fn(),
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('@/src/server/auth/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), verifyPassword: mocks.verifyPassword },
  },
}))

const createCaller = createCallerFactory(accountRouter)
const input = { password: 'correct-horse1', confirmation: 'DELETE' }

function callerFor(userId = 'user-1') {
  const ctx = {
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden', deletedAt: null },
  } as unknown as TRPCContext
  // Mutations look the session up again without the cookie cache; keep it signed in.
  vi.mocked(auth.api.getSession).mockResolvedValue({
    session: ctx.session,
    user: ctx.user,
  } as never)
  return createCaller(ctx)
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(TRPCError)
  return (error as TRPCError).code
}

describe('account.delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyPassword.mockResolvedValue({ status: true })
    mocks.prisma.$transaction.mockResolvedValue([])
  })

  it('requires authentication', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null })
    expect(await codeOf(caller.delete(input))).toBe('UNAUTHORIZED')
  })

  it('rejects an already-deleted user', async () => {
    const ctx = {
      headers: new Headers(),
      session: { id: 's', userId: 'user-1' },
      user: { id: 'user-1', deletedAt: new Date() },
    } as unknown as TRPCContext
    // The fresh lookup still finds the session, so only `deletedAt` can reject it.
    vi.mocked(auth.api.getSession).mockResolvedValue({
      session: ctx.session,
      user: ctx.user,
    } as never)
    expect(await codeOf(createCaller(ctx).delete(input))).toBe('UNAUTHORIZED')
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('needs the DELETE confirmation', async () => {
    expect(await codeOf(callerFor().delete({ ...input, confirmation: 'nope' }))).toBe('BAD_REQUEST')
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a wrong password (or an account without one) and changes nothing', async () => {
    mocks.verifyPassword.mockRejectedValue(
      new APIError('BAD_REQUEST', { message: 'Invalid password', code: 'INVALID_PASSWORD' }),
    )
    expect(await codeOf(callerFor().delete(input))).toBe('FORBIDDEN')
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses an over-long password as incorrect', async () => {
    mocks.verifyPassword.mockRejectedValue(
      new APIError('BAD_REQUEST', { message: 'Password too long', code: 'PASSWORD_TOO_LONG' }),
    )
    expect(await codeOf(callerFor().delete(input))).toBe('FORBIDDEN')
  })

  it('rejects when Better Auth no longer finds the session', async () => {
    mocks.verifyPassword.mockRejectedValue(new APIError('UNAUTHORIZED', { code: 'UNAUTHORIZED' }))
    expect(await codeOf(callerFor().delete(input))).toBe('UNAUTHORIZED')
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not hide unexpected errors', async () => {
    mocks.verifyPassword.mockRejectedValue(new Error('database down'))
    await expect(callerFor().delete(input)).rejects.toThrow('database down')
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("marks only the caller's user deleted and ends all their sessions", async () => {
    const result = await callerFor('user-9').delete(input)

    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { password: input.password },
    })
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-9' },
      data: { deletedAt: result.deletedAt },
    })
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-9' } })
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
