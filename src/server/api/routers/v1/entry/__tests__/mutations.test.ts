// @vitest-environment node
import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallerFactory, type TRPCContext } from '@/src/server/trpc/init'
import { entryRouter } from '../index'

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'

const mocks = vi.hoisted(() => {
  const tx = {
    entry: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tag: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    entryTag: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      entry: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    generateTitle: vi.fn(),
    scheduleEntryAnalysis: vi.fn(),
  }
})

vi.mock('@/src/lib/prisma', () => ({ default: mocks.prisma }))
vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('../services/EntryTitleService', () => ({
  entryTitleService: { generate: mocks.generateTitle },
}))
vi.mock('../services/scheduleEntryAnalysis', () => ({
  scheduleEntryAnalysis: mocks.scheduleEntryAnalysis,
}))

const createCaller = createCallerFactory(entryRouter)

function callerFor(userId = 'user-1') {
  return createCaller({
    headers: new Headers(),
    session: { id: 'session-1', userId },
    user: { id: userId, email: 'jaden@example.com', name: 'Jaden' },
  } as unknown as TRPCContext)
}

async function expectNotFound(promise: Promise<unknown>) {
  const error = await promise.catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(TRPCError)
  expect((error as TRPCError).code).toBe('NOT_FOUND')
}

describe('entry mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx))
    mocks.tx.entry.create.mockResolvedValue({ id: ENTRY_ID })
    mocks.tx.entry.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.entry.findUniqueOrThrow.mockResolvedValue({ id: ENTRY_ID })
    mocks.tx.tag.findMany.mockImplementation(
      async ({ where }: { where: { normalizedName: { in: string[] } } }) =>
        where.normalizedName.in.map((normalizedName) => ({ id: normalizedName, normalizedName })),
    )
    mocks.generateTitle.mockResolvedValue('Generated journal title')
  })

  it('requires authentication', async () => {
    const caller = createCaller({ headers: new Headers(), session: null, user: null })

    const error = await caller
      .create({ body: 'A private entry', timeZone: 'UTC' })
      .catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('UNAUTHORIZED')
  })

  it('generates a create title and derives the local entry date', async () => {
    await callerFor().create({
      body: 'A quiet evening at home',
      timeZone: 'Asia/Manila',
      writtenAt: '2026-08-24T16:30:00Z',
    })

    expect(mocks.generateTitle).toHaveBeenCalledWith({
      userId: 'user-1',
      body: 'A quiet evening at home',
    })
    expect(mocks.tx.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Generated journal title',
          entryDate: expect.any(Date),
        }),
      }),
    )
    const [{ data }] = mocks.tx.entry.create.mock.calls[0]
    expect(data.entryDate.toISOString().slice(0, 10)).toBe('2026-08-25')
  })

  it('preserves a supplied create title and restores matching tags for reuse', async () => {
    await callerFor().create({
      title: 'My Own Title',
      body: 'A private entry',
      timeZone: 'UTC',
      tags: [' Work ', 'work', 'Home'],
    })

    expect(mocks.generateTitle).not.toHaveBeenCalled()
    expect(mocks.tx.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'My Own Title' }) }),
    )
    expect(mocks.tx.tag.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', name: 'Work', normalizedName: 'work' },
        { userId: 'user-1', name: 'Home', normalizedName: 'home' },
      ],
      skipDuplicates: true,
    })
    expect(mocks.tx.tag.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        normalizedName: { in: ['work', 'home'] },
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    })
    expect(mocks.tx.entryTag.createMany).toHaveBeenCalledWith({
      data: [
        { entryId: ENTRY_ID, tagId: 'work' },
        { entryId: ENTRY_ID, tagId: 'home' },
      ],
    })
  })

  it('does not send inaccessible entry content to title generation', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue(null)

    await expectNotFound(callerFor().update({ id: ENTRY_ID, title: null }))

    expect(mocks.generateTitle).not.toHaveBeenCalled()
  })

  it('generates an update title from the existing body when the body is omitted', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing private journal body',
    })

    await callerFor().update({ id: ENTRY_ID, title: null })

    expect(mocks.generateTitle).toHaveBeenCalledWith({
      userId: 'user-1',
      body: 'Existing private journal body',
    })
    expect(mocks.tx.entry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ENTRY_ID, userId: 'user-1', deletedAt: null },
        data: { title: 'Generated journal title' },
      }),
    )
  })

  it('preserves the title when it is omitted and clears tag links for an empty array', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing body',
      tags: [{ tag: { normalizedName: 'work', deletedAt: null } }],
    })

    await callerFor().update({ id: ENTRY_ID, body: 'Updated body', tags: [] })

    const [{ data }] = mocks.tx.entry.updateMany.mock.calls[0]
    expect(data).toEqual({ body: 'Updated body' })
    expect(mocks.tx.entryTag.deleteMany).toHaveBeenCalledWith({ where: { entryId: ENTRY_ID } })
    expect(mocks.tx.entryTag.createMany).not.toHaveBeenCalled()
  })

  it('preserves a supplied update title, recomputes the date, and replaces tags', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing body',
      tags: [],
    })

    await callerFor().update({
      id: ENTRY_ID,
      title: 'Manual title',
      writtenAt: '2026-08-24T16:30:00Z',
      timeZone: 'Asia/Manila',
      tags: ['Home'],
    })

    expect(mocks.generateTitle).not.toHaveBeenCalled()
    expect(mocks.tx.entryTag.deleteMany).toHaveBeenCalledWith({ where: { entryId: ENTRY_ID } })
    expect(mocks.tx.entryTag.createMany).toHaveBeenCalledWith({
      data: [{ entryId: ENTRY_ID, tagId: 'home' }],
    })
    const [{ data }] = mocks.tx.entry.updateMany.mock.calls[0]
    expect(data.title).toBe('Manual title')
    expect(data.entryDate.toISOString().slice(0, 10)).toBe('2026-08-25')
  })

  it('leaves tag links alone when the tags are unchanged', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing body',
      tags: [
        { tag: { normalizedName: 'home', deletedAt: null } },
        { tag: { normalizedName: 'work', deletedAt: null } },
      ],
    })

    await callerFor().update({ id: ENTRY_ID, body: 'Updated body', tags: ['Work', 'home'] })

    expect(mocks.tx.tag.createMany).not.toHaveBeenCalled()
    expect(mocks.tx.entryTag.deleteMany).not.toHaveBeenCalled()
    expect(mocks.tx.entryTag.createMany).not.toHaveBeenCalled()
    expect(mocks.tx.entry.updateMany).toHaveBeenCalledOnce()
  })

  it('relinks tags when a linked tag was deleted, even if the names match', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing body',
      tags: [{ tag: { normalizedName: 'work', deletedAt: new Date('2026-08-01T00:00:00Z') } }],
    })

    await callerFor().update({ id: ENTRY_ID, tags: ['Work'] })

    expect(mocks.tx.tag.updateMany).toHaveBeenCalledOnce()
    expect(mocks.tx.entryTag.deleteMany).toHaveBeenCalledWith({ where: { entryId: ENTRY_ID } })
    expect(mocks.tx.entryTag.createMany).toHaveBeenCalledWith({
      data: [{ entryId: ENTRY_ID, tagId: 'work' }],
    })
  })

  it('rejects a concurrent deletion and lets the transaction callback fail', async () => {
    mocks.prisma.entry.findFirst.mockResolvedValue({
      title: 'Existing title',
      body: 'Existing body',
      tags: [],
    })
    mocks.tx.entry.updateMany.mockResolvedValue({ count: 0 })

    await expectNotFound(callerFor().update({ id: ENTRY_ID, tags: ['Work'] }))

    expect(mocks.tx.entryTag.deleteMany).toHaveBeenCalledWith({ where: { entryId: ENTRY_ID } })
    expect(mocks.tx.entry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ENTRY_ID, userId: 'user-1', deletedAt: null } }),
    )
  })

  it('soft-deletes entries and rejects repeated deletion', async () => {
    mocks.prisma.entry.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    await expect(callerFor().delete({ id: ENTRY_ID })).resolves.toEqual({ id: ENTRY_ID })
    expect(mocks.prisma.entry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ENTRY_ID, userId: 'user-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    )
    await expectNotFound(callerFor().delete({ id: ENTRY_ID }))
  })

  describe('entry analysis trigger', () => {
    beforeEach(() => {
      mocks.prisma.entry.findFirst.mockResolvedValue({
        title: 'Existing title',
        body: 'Existing body',
        tags: [],
      })
    })

    it('schedules analysis after create', async () => {
      await callerFor().create({ title: 'Title', body: 'A new entry', timeZone: 'UTC' })

      expect(mocks.scheduleEntryAnalysis).toHaveBeenCalledOnce()
      expect(mocks.scheduleEntryAnalysis).toHaveBeenCalledWith({
        entryId: ENTRY_ID,
        userId: 'user-1',
        body: 'A new entry',
      })
    })

    it('schedules analysis when the body changes', async () => {
      await callerFor().update({ id: ENTRY_ID, body: 'Updated body' })

      expect(mocks.scheduleEntryAnalysis).toHaveBeenCalledWith({
        entryId: ENTRY_ID,
        userId: 'user-1',
        body: 'Updated body',
      })
    })

    it.each([
      ['the body is unchanged', { body: 'Existing body' }],
      ['only the title changes', { title: 'New title' }],
      ['only the tags change', { tags: ['Work'] }],
      ['only the date changes', { writtenAt: '2026-08-24T16:30:00Z', timeZone: 'UTC' }],
    ])('does not schedule analysis when %s', async (_case, changes) => {
      await callerFor().update({ id: ENTRY_ID, ...changes })

      expect(mocks.scheduleEntryAnalysis).not.toHaveBeenCalled()
    })

    it('does not schedule analysis when the update fails', async () => {
      mocks.tx.entry.updateMany.mockResolvedValue({ count: 0 })

      await expectNotFound(callerFor().update({ id: ENTRY_ID, body: 'Updated body' }))
      expect(mocks.scheduleEntryAnalysis).not.toHaveBeenCalled()
    })
  })
})
