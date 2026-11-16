import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }))

const findOneKey = ({ id }: { id: string }) => ['findOne', id]

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      entry: {
        create: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
        update: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
        delete: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
        findOne: {
          queryKey: findOneKey,
          queryOptions: (input: { id: string }) => ({
            queryKey: findOneKey(input),
            queryFn: mocks.findOne,
          }),
        },
        findMany: { pathFilter: () => ({ queryKey: ['findMany'] }) },
        weekMoods: { pathFilter: () => ({ queryKey: ['weekMoods'] }) },
        stats: { pathFilter: () => ({ queryKey: ['stats'] }) },
      },
    },
  }),
}))

const { useEntryAutosave, ANALYSIS_POLL_INTERVAL_MS, ANALYSIS_POLL_WINDOW_MS } =
  await import('./use-entry-autosave')

const NOW = new Date('2026-11-16T07:00:00.000Z').getTime()
const entry = {
  id: 'entry-1',
  title: 'Late night, good presentation',
  body: 'Stayed up finishing the slides.',
  tags: [],
  writtenAt: new Date(NOW - 5_000).toISOString(),
}

/** The entry as `findOne` returns it (hydrated from the server on the entry page). */
const dto = (updatedAt: number, analyzedAt: number | null) => ({
  ...entry,
  updatedAt: new Date(updatedAt).toISOString(),
  analysis: analyzedAt === null ? null : { analyzedAt: new Date(analyzedAt).toISOString() },
})

function renderAutosave(cached: unknown) {
  const queryClient = new QueryClient()
  if (cached) queryClient.setQueryData(findOneKey({ id: entry.id }), cached)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useEntryAutosave(entry), { wrapper })
}

describe('useEntryAutosave: analysis pending when the editor opens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.findOne.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('shows Analyzing for an entry saved elsewhere moments ago, until its analysis arrives', async () => {
    const savedAt = NOW - 3_000 // e.g. created from a voice session, then opened
    mocks.findOne
      .mockResolvedValueOnce(dto(savedAt, null))
      .mockResolvedValueOnce(dto(savedAt, savedAt + 30_000))

    const { result } = renderAutosave(dto(savedAt, null))
    expect(result.current.analyzing).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(ANALYSIS_POLL_INTERVAL_MS))
    expect(result.current.analyzing).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(ANALYSIS_POLL_INTERVAL_MS))
    expect(mocks.findOne).toHaveBeenCalledTimes(2)
    expect(result.current.analyzing).toBe(false)
  })

  it.each([
    ['already has an up-to-date analysis', dto(NOW - 3_000, NOW - 1_000)],
    ['was saved too long ago to still be analyzing', dto(NOW - ANALYSIS_POLL_WINDOW_MS - 1, null)],
    ['is not in the cache', null],
  ])('does not wait when the entry %s', async (_label, cached) => {
    const { result } = renderAutosave(cached)

    expect(result.current.analyzing).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(ANALYSIS_POLL_INTERVAL_MS * 2))
    expect(mocks.findOne).not.toHaveBeenCalled()
  })
})
