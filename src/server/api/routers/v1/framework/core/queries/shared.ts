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
} satisfies Prisma.FrameworkSelect

type FrameworkRow = Prisma.FrameworkGetPayload<{ select: typeof frameworkSelect }>

export function toFrameworkDto(row: FrameworkRow) {
  return { ...row, prompts: FrameworkPromptsSchema.parse(row.prompts) }
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
  return rows.map(toFrameworkDto)
}

export async function findOneFrameworkBySlugForUser(userId: string, slug: string) {
  const row = await prisma.framework.findFirst({
    where: { ...frameworkWhereForUser(userId), slug },
    select: frameworkSelect,
  })
  return row ? toFrameworkDto(row) : null
}
