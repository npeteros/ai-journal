import { journalFixtureEntries, type JournalFixtureEntry } from './journal-fixtures'

type EntryWhere = {
  userId?: unknown
  id?: unknown
  deletedAt?: unknown
  OR?: Array<{ title?: { contains?: unknown }; body?: { contains?: unknown } }>
  entryDate?: { gte?: unknown; lte?: unknown }
}

type UsageLog = {
  id: string
  userId: string | null
  createdAt: Date
  model: string
  agent: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function matchesWhere(entry: JournalFixtureEntry, where: EntryWhere): boolean {
  if (typeof where.userId === 'string' && entry.userId !== where.userId) return false
  if (typeof where.id === 'string' && entry.id !== where.id) return false
  if (where.deletedAt === null && entry.deletedAt !== null) return false

  if (where.OR) {
    const matchesSearch = where.OR.some((condition) => {
      const titleNeedle = condition.title?.contains
      const bodyNeedle = condition.body?.contains
      return [titleNeedle, bodyNeedle].some(
        (needle) =>
          typeof needle === 'string' &&
          (entry.title.toLowerCase().includes(needle.toLowerCase()) ||
            entry.body.toLowerCase().includes(needle.toLowerCase())),
      )
    })
    if (!matchesSearch) return false
  }

  const { entryDate } = where
  if (entryDate?.gte instanceof Date && entry.entryDate < entryDate.gte) return false
  if (entryDate?.lte instanceof Date && entry.entryDate > entryDate.lte) return false
  return true
}

function entryWithTags(entry: JournalFixtureEntry) {
  return { ...entry, tags: [] }
}

/**
 * Test-only Prisma surface for live-model evals. It serves immutable synthetic entries and keeps
 * usage reservations in memory, so evaluation runs cannot read or write a real journal database.
 */
export function createFixturePrisma() {
  const entries = journalFixtureEntries.map((entry) => ({ ...entry }))
  const usageLogs: UsageLog[] = []

  const matchingEntries = (where: EntryWhere) =>
    entries
      .filter((entry) => matchesWhere(entry, where))
      .sort((left, right) => right.writtenAt.getTime() - left.writtenAt.getTime())
      .map(entryWithTags)

  const usageTable = {
    count: async ({ where }: { where: { userId: string; createdAt: { gte: Date } } }) =>
      usageLogs.filter(
        (entry) => entry.userId === where.userId && entry.createdAt >= where.createdAt.gte,
      ).length,
    create: async ({
      data,
    }: {
      data: Omit<UsageLog, 'id' | 'createdAt'>
      select: { id: true }
    }) => {
      const id = `eval-usage-${usageLogs.length + 1}`
      usageLogs.push({ ...data, id, createdAt: new Date() })
      return { id }
    },
  }

  const prisma = {
    entry: {
      findMany: async ({ where }: { where: EntryWhere }) => matchingEntries(where),
      count: async ({ where }: { where: EntryWhere }) => matchingEntries(where).length,
      findFirst: async ({ where }: { where: EntryWhere }) => matchingEntries(where)[0] ?? null,
    },
    aiUsageLog: {
      update: async ({ where, data }: { where: { id: string }; data: Partial<UsageLog> }) => {
        const log = usageLogs.find((entry) => entry.id === where.id)
        if (!log) throw new Error(`Unknown fixture usage log: ${where.id}`)
        Object.assign(log, data)
        return log
      },
    },
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input)
      if (typeof input !== 'function') throw new Error('Unsupported fixture transaction')
      return input({
        $executeRaw: async () => 0,
        aiUsageLog: usageTable,
      })
    },
  }

  return { prisma, usageLogs }
}

export function fixtureWhere(value: unknown): EntryWhere {
  return asRecord(value) as EntryWhere
}
