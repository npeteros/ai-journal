import type { Prisma } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import { FrameworkPromptsSchema } from '../../schema'

export const frameworkSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  minutes: true,
  icon: true,
  prompts: true,
  userId: true,
} satisfies Prisma.FrameworkSelect

type FrameworkRow = Prisma.FrameworkGetPayload<{ select: typeof frameworkSelect }>

/** `isOwn` replaces the raw owner id: built-in templates are never the viewer's own. */
export function toFrameworkDto({ userId: ownerId, ...row }: FrameworkRow, userId: string) {
  return {
    ...row,
    prompts: FrameworkPromptsSchema.parse(row.prompts),
    isOwn: ownerId === userId,
  }
}

export type FrameworkDto = ReturnType<typeof toFrameworkDto>

/** Active frameworks the user can see: built-in templates (no owner) and, later, their own. */
export function frameworkWhereForUser(userId: string) {
  return {
    deletedAt: null,
    OR: [{ userId: null }, { userId }],
  } satisfies Prisma.FrameworkWhereInput
}

export async function findManyFrameworksForUser(userId: string) {
  const rows = await prisma.framework.findMany({
    where: frameworkWhereForUser(userId),
    select: frameworkSelect,
    orderBy: [{ createdAt: 'asc' }, { slug: 'asc' }],
  })
  return rows.map((row) => toFrameworkDto(row, userId))
}

export async function findOneFrameworkBySlugForUser(userId: string, slug: string) {
  const row = await prisma.framework.findFirst({
    where: { ...frameworkWhereForUser(userId), slug },
    select: frameworkSelect,
  })
  return row ? toFrameworkDto(row, userId) : null
}
