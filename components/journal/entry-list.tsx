'use client'

import { useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { Search } from 'lucide-react'

import { Chip } from '@/components/ui/chip'
import { EASE_OUT } from '@/components/motion'
import type { PlaceholderEntry } from '@/src/lib/placeholder/entries'
import { EntryCard } from './entry-card'

/**
 * Filter chips + search on one row, then the entry grid.
 * Filtering animates cards in/out and reflows the grid.
 */
export function EntryList({
  entries,
  filters,
}: {
  entries: PlaceholderEntry[]
  filters: readonly string[]
}) {
  const [filter, setFilter] = useState<string>(filters[0] ?? 'All')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visible = entries.filter(
    (e) =>
      (filter === 'All' || e.tags.includes(filter)) &&
      (!q || e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)),
  )

  return (
    <LayoutGroup>
      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="toolbar"
          aria-label="Filter entries"
          className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 md:pb-0"
        >
          {filters.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={f === filter}>
              <Chip variant={f === filter ? 'filter-active' : 'filter'}>{f}</Chip>
            </button>
          ))}
        </div>

        <label className="flex h-[42px] w-full shrink-0 items-center gap-2 rounded-[11px] border border-neutral-200 bg-surface px-3.5 transition-colors focus-within:border-neutral-400 md:w-[280px]">
          <Search className="size-[15px] text-neutral-400" strokeWidth={2} />
          <span className="sr-only">Search entries</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <motion.ul layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={true}>
          {visible.map((entry, i) => (
            <motion.li
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: i * 0.07 + 0.12 }}
            >
              <EntryCard entry={entry} href={`/journal/${entry.id}`} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {visible.length === 0 && (
        <p className="py-10 text-center text-[14px] text-neutral-400">
          No entries match{q ? ` “${query.trim()}”` : ''}
          {filter !== 'All' ? ` in ${filter}` : ''}.
        </p>
      )}
    </LayoutGroup>
  )
}
