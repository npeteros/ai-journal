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

export async function findOrCreateTags(
  tx: Prisma.TransactionClient,
  userId: string,
  names: string[],
) {
  const tags = []

  for (const name of names) {
    const normalizedName = name.toLowerCase()
    const tag = await tx.tag.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      create: { userId, name, normalizedName },
      // A matching soft-deleted tag is restored and retains its existing identity.
      update: { deletedAt: null },
    })
    tags.push(tag)
  }

  return tags
}
