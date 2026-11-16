// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findManyEntriesForUser, findOneEntryForUser } from '../shared'

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    entry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))

const dbEntry = {
  id: ENTRY_ID,
  userId: 'user-1',
  title: 'A slower morning',
  body: 'Coffee and quiet',
  writtenAt: new Date('2026-08-25T00:14:00Z'),
  entryDate: new Date('2026-08-25T00:00:00Z'),
  createdAt: new Date('2026-08-25T00:14:00Z'),
  updatedAt: new Date('2026-08-25T00:14:00Z'),
  deletedAt: null,
  tags: [],
  analysis: null,
}

const analysis = {
  mood: 'calm',
  moodScore: 72,
  summary: ['You took a slow morning with coffee.'],
  themes: ['rest'],
  suggestedTags: ['mornings'],
  analyzedAt: new Date('2026-08-25T00:15:00Z'),
}

describe('shared entry queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    )
    mocks.prisma.entry.findMany.mockResolvedValue([dbEntry])
    mocks.prisma.entry.count.mockResolvedValue(1)
  })

  it('preserves S1-09 user, soft-delete, date-range, and paging filters', async () => {
    await expect(
      findManyEntriesForUser('user-1', {
        skip: 0,
        take: 10,
        searchText: 'coffee',
        entryStartDate: '2026-08-01',
        entryEndDate: '2026-08-31',
      }),
    ).resolves.toEqual({ items: [{ ...dbEntry, tags: [] }], total: 1 })

    expect(mocks.prisma.entry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', deletedAt: null }),
        skip: 0,
        take: 10,
      }),
    )
    const where = mocks.prisma.entry.findMany.mock.calls[0][0].where
    expect(where.entryDate.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(where.entryDate.lte.toISOString()).toBe('2026-08-31T00:00:00.000Z')
  })

  it('returns null for an entry that is missing, deleted, or owned by another user', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue(null)

    await expect(findOneEntryForUser('user-2', ENTRY_ID)).resolves.toBeNull()
    expect(mocks.prisma.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ENTRY_ID, userId: 'user-2', deletedAt: null } }),
    )
  })

  it('selects the public analysis fields only', async () => {
    await findManyEntriesForUser('user-1', { skip: 0, take: 10 })

    const { include } = mocks.prisma.entry.findMany.mock.calls[0][0]
    expect(include.analysis).toEqual({
      select: {
        mood: true,
        moodScore: true,
        summary: true,
        themes: true,
        suggestedTags: true,
        analyzedAt: true,
      },
    })
  })

  it('returns the analysis when one exists and null otherwise', async () => {
    mocks.prisma.entry.findMany.mockResolvedValue([{ ...dbEntry, analysis }, dbEntry])
    mocks.prisma.entry.findFirst.mockResolvedValue({ ...dbEntry, analysis })

    const { items } = await findManyEntriesForUser('user-1', { skip: 0, take: 10 })
    expect(items.map((item) => item.analysis)).toEqual([analysis, null])
    await expect(findOneEntryForUser('user-1', ENTRY_ID)).resolves.toMatchObject({ analysis })
    expect(mocks.prisma.entry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ analysis: expect.any(Object) }),
      }),
    )
  })
})
