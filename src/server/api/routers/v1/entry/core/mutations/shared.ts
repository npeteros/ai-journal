import type { Prisma } from '@/src/generated/prisma/client'

export function getEntryDate(writtenAt: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(writtenAt)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
}

/**
 * Finds or creates the user's tags for `names` (already de-duplicated case-insensitively by the
 * schema), in the given order. Three queries however many tags there are.
 */
export async function findOrCreateTags(
  tx: Prisma.TransactionClient,
  userId: string,
  names: string[],
) {
  if (names.length === 0) return []

  const rows = names.map((name) => ({ userId, name, normalizedName: name.toLowerCase() }))
  const normalizedNames = rows.map((row) => row.normalizedName)

  await tx.tag.createMany({ data: rows, skipDuplicates: true })
  // A matching soft-deleted tag is restored and retains its existing identity.
  await tx.tag.updateMany({
    where: { userId, normalizedName: { in: normalizedNames }, deletedAt: { not: null } },
    data: { deletedAt: null },
  })
  const tags = await tx.tag.findMany({
    where: { userId, normalizedName: { in: normalizedNames } },
  })

  const byName = new Map(tags.map((tag) => [tag.normalizedName, tag]))
  return normalizedNames.flatMap((normalizedName) => byName.get(normalizedName) ?? [])
}

type LinkedTag = { tag: { normalizedName: string; deletedAt: Date | null } }

/** Whether `names` matches the entry's current tags, ignoring order and case. */
export function hasSameTags(current: LinkedTag[], names: string[]) {
  // A link to a deleted tag means the stored set differs from what the user sees.
  if (current.some(({ tag }) => tag.deletedAt !== null)) return false
  const next = new Set(names.map((name) => name.toLowerCase()))
  return current.length === next.size && current.every(({ tag }) => next.has(tag.normalizedName))
}
