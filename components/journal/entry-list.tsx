'use client'

import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { EASE_OUT } from '@/components/motion'
import { PAGE_SIZE_DEFAULT, SEARCH_TEXT_MAX_LENGTH } from '@/src/server/api/routers/v1/entry/schema'
import { useTRPC } from '@/src/server/trpc/client'
import { getApiErrorMessage } from './api-error'
import { EntryCard } from './entry-card'

const SEARCH_DEBOUNCE_MS = 300

type EntryGroup<T> = { label: string; entries: T[] }

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function localDateKey(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const groupDateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * "Today", "Yesterday", then the date. `entryDate` is a date-only value (UTC midnight).
 * It's an ISO string when fetched over HTTP, but a `Date` when it comes from the RSC prefetch
 * (the server caller skips JSON, and RSC serialization keeps Dates), so accept both.
 */
function dateLabel(entryDate: string | Date, now: Date) {
  const key = new Date(entryDate).toISOString().slice(0, 10)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (key === localDateKey(now)) return 'Today'
  if (key === localDateKey(yesterday)) return 'Yesterday'
  return groupDateFormat.format(new Date(`${key}T00:00:00.000Z`))
}

/**
 * Filter chips + search on one row, then the entries grouped by day.
 * Search, tag filter and "Load more" all go through the entry API.
 */
export function EntryList() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  // Browser clock: "Today"/"Yesterday" labels and the card dates
  const [now] = useState(() => new Date())

  const [query, setQuery] = useState('')
  const [tagId, setTagId] = useState<string | undefined>(undefined)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const searchText = debouncedQuery.trim() || undefined
  const hasFilters = searchText !== undefined || tagId !== undefined

  const tagsQuery = useQuery(trpc.v1.tag.findMany.queryOptions())
  const tags = tagsQuery.data ?? []

  const entriesQuery = useInfiniteQuery({
    // Prefix matches trpc.v1.entry.findMany.pathFilter(), so saving or deleting an entry
    // invalidates this list too. Keep in sync with app/(app)/journal/page.tsx.
    queryKey: [...trpc.v1.entry.findMany.pathKey(), 'journal-home', { searchText, tagId }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      queryClient.fetchQuery(
        trpc.v1.entry.findMany.queryOptions({
          skip: pageParam,
          take: PAGE_SIZE_DEFAULT,
          searchText,
          tagId,
        }),
      ),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
    placeholderData: keepPreviousData,
  })

  const entries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [entriesQuery.data],
  )

  const groups = useMemo(() => {
    const result: EntryGroup<(typeof entries)[number]>[] = []
    for (const entry of entries) {
      const label = dateLabel(entry.entryDate, now)
      const last = result[result.length - 1]
      if (last?.label === label) last.entries.push(entry)
      else result.push({ label, entries: [entry] })
    }
    return result
  }, [entries, now])

  const selectedTag = tags.find((t) => t.id === tagId)

  return (
    <LayoutGroup>
      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="toolbar"
          aria-label="Filter entries"
          className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 md:pb-0"
        >
          <button type="button" onClick={() => setTagId(undefined)} aria-pressed={!tagId}>
            <Chip variant={!tagId ? 'filter-active' : 'filter'}>All</Chip>
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTagId(t.id === tagId ? undefined : t.id)}
              aria-pressed={t.id === tagId}
            >
              <Chip variant={t.id === tagId ? 'filter-active' : 'filter'}>{t.name}</Chip>
            </button>
          ))}
        </div>

        <label className="flex h-[42px] w-full shrink-0 items-center gap-2 rounded-[11px] border border-neutral-200 bg-surface px-3.5 transition-colors focus-within:border-neutral-400 md:w-[280px]">
          <Search className="size-[15px] text-neutral-400" strokeWidth={2} />
          <span className="sr-only">Search entries</span>
          <input
            type="search"
            value={query}
            maxLength={SEARCH_TEXT_MAX_LENGTH}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      {entriesQuery.isPending ? (
        <ul
          aria-busy="true"
          aria-label="Loading entries"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Card className="flex h-full animate-pulse flex-col gap-2 p-5">
                <div className="h-2.5 w-20 rounded bg-neutral-200" />
                <div className="h-5 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-full rounded bg-neutral-100" />
                <div className="h-3 w-5/6 rounded bg-neutral-100" />
              </Card>
            </li>
          ))}
        </ul>
      ) : entriesQuery.isError && entries.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[14px] text-neutral-600">{getApiErrorMessage(entriesQuery.error)}</p>
          <Button variant="soft" size="md" onClick={() => entriesQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-neutral-400">
          {hasFilters
            ? `No entries match${searchText ? ` “${searchText}”` : ''}${selectedTag ? ` in ${selectedTag.name}` : ''}.`
            : 'No entries yet. Your first one will show up here.'}
        </p>
      ) : (
        <div
          className={entriesQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
        >
          {groups.map((group) => (
            <section key={group.label} className="mb-8 flex flex-col gap-3">
              {/* Day labels come from the browser's clock, so they can differ from the server's */}
              <h2
                suppressHydrationWarning
                className="text-[12px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase"
              >
                {group.label}
              </h2>
              <motion.ul
                layout
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3"
              >
                <AnimatePresence mode="popLayout" initial={true}>
                  {group.entries.map((entry, i) => (
                    <motion.li
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(3px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                      transition={{
                        duration: 0.7,
                        ease: EASE_OUT,
                        delay: Math.min(i, 8) * 0.07 + 0.12,
                      }}
                    >
                      <EntryCard
                        entry={{
                          id: entry.id,
                          title: entry.title,
                          body: entry.body,
                          writtenAt: entry.writtenAt,
                          tags: entry.tags.map((t) => t.name),
                        }}
                        now={now}
                        href={`/journal/${entry.id}`}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}

          {entriesQuery.isFetchNextPageError && (
            <p role="alert" className="pb-3 text-center text-[13px] text-neutral-600">
              {getApiErrorMessage(entriesQuery.error)}
            </p>
          )}
          {entriesQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="soft"
                size="md"
                onClick={() => entriesQuery.fetchNextPage()}
                disabled={entriesQuery.isFetchingNextPage}
              >
                {entriesQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </LayoutGroup>
  )
}
