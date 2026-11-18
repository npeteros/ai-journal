import { APIError } from 'better-auth/api'

import prisma from '@/src/lib/prisma'

export const DELETED_ACCOUNT_MESSAGE = 'This account has been deleted.'

/** Throws (so no session is created) when the user has deleted their account. */
export async function assertAccountNotDeleted(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } })

  if (user?.deletedAt) {
    throw new APIError('UNAUTHORIZED', { message: DELETED_ACCOUNT_MESSAGE })
  }
}
