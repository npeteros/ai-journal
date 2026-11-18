import { TRPCError } from '@trpc/server'
import { isAPIError } from 'better-auth/api'

import prisma from '@/src/lib/prisma'
import { auth } from '@/src/server/auth/auth'
import { deleteAccountSchema } from '@/src/server/auth/schemas/delete-account'
import { protectedProcedure } from '@/src/server/trpc/init'

/** Better Auth error codes that mean the password didn't match (or can't, e.g. too long). */
const WRONG_PASSWORD_CODES = new Set(['INVALID_PASSWORD', 'PASSWORD_TOO_LONG'])

/**
 * Checks the password through Better Auth's `verifyPassword`, which reads the credential account
 * and hashes the same way sign-in does. An account with no password also fails as incorrect.
 */
async function confirmPassword(headers: Headers, password: string) {
  try {
    await auth.api.verifyPassword({ headers, body: { password } })
  } catch (error) {
    if (!isAPIError(error)) throw error
    if (error.status === 'UNAUTHORIZED') throw new TRPCError({ code: 'UNAUTHORIZED' })
    if (WRONG_PASSWORD_CODES.has(String(error.body?.code))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Incorrect password.' })
    }
    throw error
  }
}

/**
 * Soft-deletes the signed-in user's own account (policy A): marks the user deleted and ends
 * every session, including this one. Sign-in is then refused (`assertAccountNotDeleted`). The
 * user's data stays until a separate purge job removes it after the grace period.
 */
export const deleteAccount = protectedProcedure
  .input(deleteAccountSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id

    await confirmPassword(ctx.headers, input.password)

    const deletedAt = new Date()
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt } }),
      prisma.session.deleteMany({ where: { userId } }),
    ])

    return { deletedAt }
  })
