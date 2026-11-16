'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, X } from 'lucide-react'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { EASE_OUT } from '@/components/motion'
import { Chip } from '@/components/ui/chip'
import { formatEntryDateTime } from '@/src/lib/format'
import { useTRPC } from '@/src/server/trpc/client'
import type { EntryRef } from './citations'

type EntryPreviewPanelProps = {
  /** The cited entry to preview; `null` closes the panel. */
  entry: EntryRef | null
  onClose: () => void
}

export function EntryPreviewPanel({ entry, onClose }: EntryPreviewPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!entry) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [entry, onClose])

  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-neutral-900/20"
          />
          <motion.dialog
            key="panel"
            open
            aria-modal="true"
            aria-labelledby="entry-preview-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="fixed inset-y-0 right-0 left-auto z-50 m-0 flex h-dvh max-h-none w-full max-w-none flex-col p-0 text-inherit border-l border-neutral-200 bg-surface shadow-xl sm:w-[440px]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 pt-[calc(14px+env(safe-area-inset-top))] pb-3.5">
              <p className="text-[11px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase">
                Cited entry
              </p>
              <div className="flex items-center gap-1">
                <a
                  href={`/journal/${entry.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-cloud-700 hover:bg-neutral-100"
                >
                  Open in new tab
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close preview"
                  className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </header>
            <EntryPreviewBody entry={entry} />
          </motion.dialog>
        </>
      )}
    </AnimatePresence>
  )
}

function EntryPreviewBody({ entry }: { entry: EntryRef }) {
  const trpc = useTRPC()
  const [now] = useState(() => new Date())
  const query = useQuery(trpc.v1.entry.findOne.queryOptions({ id: entry.id }))

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <h2
        id="entry-preview-title"
        className="font-serif text-[22px] leading-[1.25] font-semibold text-neutral-900"
      >
        {query.data?.title ?? entry.title}
      </h2>

      {query.isPending && (
        <div className="flex flex-col gap-2" aria-label="Loading entry">
          <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
        </div>
      )}

      {query.isError && (
        <p role="alert" className="text-[14px] leading-normal text-neutral-600">
          {getApiErrorMessage(query.error)}
        </p>
      )}

      {query.data && (
        <>
          <p
            suppressHydrationWarning
            className="text-[12px] leading-none font-semibold text-neutral-400"
          >
            {formatEntryDateTime(new Date(query.data.writtenAt).toISOString(), now)}
          </p>
          {query.data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {query.data.tags.map((tag) => (
                <Chip key={tag.id}>{tag.name}</Chip>
              ))}
            </div>
          )}
          <p className="mt-1 text-[15px] leading-[1.65] whitespace-pre-wrap text-neutral-900">
            {query.data.body}
          </p>
        </>
      )}
    </div>
  )
}
