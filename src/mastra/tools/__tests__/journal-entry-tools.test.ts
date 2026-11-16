// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntryTool } from '../get-entry-tool'
import {
  ENTRY_EXCERPT_MAX_LENGTH,
  ENTRY_SEARCH_LIMIT,
  searchEntriesTool,
} from '../search-entries-tool'

const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174000'

const mocks = vi.hoisted(() => ({
  findManyEntriesForUser: vi.fn(),
  findOneEntryForUser: vi.fn(),
}))

vi.mock('@/src/server/api/routers/v1/entry/core/queries/shared', () => mocks)

function contextFor(userId: unknown) {
  return {
    requestContext: { get: vi.fn().mockReturnValue(userId) },
  } as never
}

const entry = {
  id: ENTRY_ID,
  userId: 'user-1',
  title: 'A slower morning',
  body: `  Coffee\n${'and quiet '.repeat(100)} `,
  writtenAt: new Date('2026-08-25T00:14:00Z'),
  entryDate: new Date('2026-08-25T00:00:00Z'),
  createdAt: new Date('2026-08-25T00:14:00Z'),
  updatedAt: new Date('2026-08-25T00:14:00Z'),
  deletedAt: null,
  tags: [],
}

describe('journal entry tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches only the context user with a bounded result shape and citation metadata', async () => {
    mocks.findManyEntriesForUser.mockResolvedValue({ items: [entry], total: 1 })

    const result = await searchEntriesTool.execute!(
      { keyword: 'coffee', entryStartDate: '2026-08-01', entryEndDate: '2026-08-31' },
      contextFor('user-1'),
    )
    if (!result || !('entries' in result)) throw new Error('Expected search entry result')

    expect(mocks.findManyEntriesForUser).toHaveBeenCalledWith('user-1', {
      skip: 0,
      take: ENTRY_SEARCH_LIMIT,
      searchText: 'coffee',
      entryStartDate: '2026-08-01',
      entryEndDate: '2026-08-31',
    })
    expect(result.entries[0]).toMatchObject({
      id: ENTRY_ID,
      title: 'A slower morning',
      date: '2026-08-25',
    })
    expect(result.entries[0].excerpt.length).toBeLessThanOrEqual(ENTRY_EXCERPT_MAX_LENGTH)
  })

  it('does not query when context is absent and cannot accept a model-controlled user ID', async () => {
    await expect(
      searchEntriesTool.execute!(
        { keyword: 'coffee', userId: 'attacker' } as unknown as { keyword?: string },
        contextFor(undefined),
      ),
    ).resolves.toEqual({ entries: [] })
    await expect(getEntryTool.execute!({ id: ENTRY_ID }, contextFor(null))).resolves.toEqual({
      entry: null,
    })
    expect(mocks.findManyEntriesForUser).not.toHaveBeenCalled()
    expect(mocks.findOneEntryForUser).not.toHaveBeenCalled()
  })

  it('returns a full entry only for the context user and maps citation metadata', async () => {
    mocks.findOneEntryForUser.mockResolvedValue(entry)

    await expect(getEntryTool.execute!({ id: ENTRY_ID }, contextFor('user-1'))).resolves.toEqual({
      entry: {
        id: ENTRY_ID,
        title: 'A slower morning',
        date: '2026-08-25',
        body: entry.body,
      },
    })
    expect(mocks.findOneEntryForUser).toHaveBeenCalledWith('user-1', ENTRY_ID)
  })
})
