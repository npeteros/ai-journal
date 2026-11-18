import { TRPCError } from '@trpc/server'

import prisma from '@/src/lib/prisma'
import { auth } from '@/src/server/auth/auth'
import { deleteAccountSchema } from '@/src/server/auth/schemas/delete-account'
import { protectedProcedure } from '@/src/server/trpc/init'

/**
 * Soft-deletes the signed-in user's own account (policy A): marks the user deleted and ends
 * every session, including this one. Sign-in is then refused (`assertAccountNotDeleted`). The
 * user's data stays until a separate purge job removes it after the grace period.
 */
export const deleteAccount = protectedProcedure
  .input(deleteAccountSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id

    const credential = await prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    })

    if (!credential?.password) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This account has no password to confirm with.',
      })
    }

    const { password: hasher } = await auth.$context
    const valid = await hasher.verify({ hash: credential.password, password: input.password })

    if (!valid) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Incorrect password.' })
    }

    const deletedAt = new Date()
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt } }),
      prisma.session.deleteMany({ where: { userId } }),
    ])

    return { deletedAt }
  })
