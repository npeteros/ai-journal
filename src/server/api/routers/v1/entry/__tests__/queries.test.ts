// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { entryRouter } from '../index'
import { PAGE_SIZE_DEFAULT } from '../schema'

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'
const TAG_ID = '223e4567-e89b-12d3-a456-426614174000'

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
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('../services/EntryTitleService', () => ({ entryTitleService: { generate: vi.fn() } }))

const createCaller = createCallerFactory(entryRouter)

function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden' },
  } as unknown as TRPCContext)
}

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
  tags: [{ tag: { id: TAG_ID, name: 'Gratitude' } }],
}

const { tags: _tags, ...dbEntryFields } = dbEntry
const expectedEntry = { ...dbEntryFields, tags: [{ id: TAG_ID, name: 'Gratitude' }] }

function findManyArgs() {
  return mocks.prisma.entry.findMany.mock.calls[0][0]
}

describe('entry queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    )
    mocks.prisma.entry.findMany.mockResolvedValue([dbEntry])
    mocks.prisma.entry.count.mockResolvedValue(1)
  })

  it('requires authentication', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null })

    for (const call of [caller.findMany({}), caller.findOne({ id: ENTRY_ID })]) {
      const error = await call.catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe('UNAUTHORIZED')
    }
  })

  describe('findMany', () => {
    it('scopes to the user, excludes deleted entries, and applies default paging', async () => {
      await expect(callerFor().findMany({})).resolves.toEqual({
        items: [expectedEntry],
        total: 1,
      })

      const args = findManyArgs()
      expect(args.where).toEqual({ userId: 'user-1', deletedAt: null })
      expect(args.orderBy).toEqual([{ writtenAt: 'desc' }, { id: 'desc' }])
      expect(args.skip).toBe(0)
      expect(args.take).toBe(PAGE_SIZE_DEFAULT)
      expect(args.include.tags.where).toEqual({ tag: { deletedAt: null } })
      expect(mocks.prisma.entry.count).toHaveBeenCalledWith({ where: args.where })
    })

    it('passes skip and take through', async () => {
      await callerFor().findMany({ skip: 40, take: 10 })

      expect(findManyArgs()).toEqual(expect.objectContaining({ skip: 40, take: 10 }))
    })

    it('searches title and body case-insensitively', async () => {
      await callerFor().findMany({ searchText: '  coffee  ' })

      expect(findManyArgs().where.OR).toEqual([
        { title: { contains: 'coffee', mode: 'insensitive' } },
        { body: { contains: 'coffee', mode: 'insensitive' } },
      ])
    })

    it('filters by a tag owned by the user', async () => {
      await callerFor().findMany({ tagId: TAG_ID })

      expect(findManyArgs().where.tags).toEqual({
        some: { tagId: TAG_ID, tag: { userId: 'user-1', deletedAt: null } },
      })
    })

    it('filters entryDate with inclusive UTC-midnight bounds', async () => {
      await callerFor().findMany({ entryStartDate: '2026-08-01', entryEndDate: '2026-08-31' })

      const { entryDate } = findManyArgs().where
      expect(entryDate.gte.toISOString()).toBe('2026-08-01T00:00:00.000Z')
      expect(entryDate.lte.toISOString()).toBe('2026-08-31T00:00:00.000Z')
    })

    it('supports an open-ended date range', async () => {
      await callerFor().findMany({ entryEndDate: '2026-08-31' })

      expect(Object.keys(findManyArgs().where.entryDate)).toEqual(['lte'])
    })
  })

  describe('findOne', () => {
    it('returns the entry with flattened tags', async () => {
      mocks.prisma.entry.findFirst.mockResolvedValue(dbEntry)

      await expect(callerFor().findOne({ id: ENTRY_ID })).resolves.toEqual(expectedEntry)
      expect(mocks.prisma.entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ENTRY_ID, userId: 'user-1', deletedAt: null } }),
      )
    })

    it('reports missing, deleted, or another user’s entries as NOT_FOUND', async () => {
      mocks.prisma.entry.findFirst.mockResolvedValue(null)

      const error = await callerFor('user-2')
        .findOne({ id: ENTRY_ID })
        .catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe('NOT_FOUND')
      expect(mocks.prisma.entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-2' }) }),
      )
    })
  })
})
