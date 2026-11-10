// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createFixturePrisma } from '../in-memory-prisma'
import {
  EVAL_USER_A_ID,
  EVAL_USER_B_ID,
  journalFixtureEntries,
  journalFixtureEntrySchema,
} from '../journal-fixtures'

describe('journal evaluation fixtures', () => {
  it('contains only schema-valid synthetic entries', () => {
    expect(journalFixtureEntries).toHaveLength(8)
    for (const entry of journalFixtureEntries) {
      expect(journalFixtureEntrySchema.safeParse(entry).success).toBe(true)
      expect(entry.title).toMatch(/\S/)
      expect(entry.body).toMatch(/\S/)
    }
  })

  it('scopes fixture search to a user and excludes soft-deleted entries', async () => {
    const { prisma } = createFixturePrisma()
    const entries = await prisma.entry.findMany({
      where: {
        userId: EVAL_USER_A_ID,
        deletedAt: null,
        OR: [{ body: { contains: 'compass' } }],
      },
    })

    expect(entries).toEqual([])
  })

  it('does not expose user B fixture data when querying as user A', async () => {
    const { prisma } = createFixturePrisma()
    const entries = await prisma.entry.findMany({
      where: {
        userId: EVAL_USER_A_ID,
        deletedAt: null,
        OR: [{ body: { contains: 'cobalt telescope' } }],
      },
    })

    expect(entries).toEqual([])
    expect(EVAL_USER_A_ID).not.toBe(EVAL_USER_B_ID)
  })
})
