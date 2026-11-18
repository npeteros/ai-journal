'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, X } from 'lucide-react'
import { Portal } from 'radix-ui'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { EASE_OUT, Rise } from '@/components/motion'
import { AiLabel } from '@/components/ui/ai'
import { Chip, MoodDot } from '@/components/ui/chip'
import { moodLabel } from '@/src/lib/design-tokens/colors'
import { formatEntryDateTime } from '@/src/lib/format'
import { useTRPC } from '@/src/server/trpc/client'
import type { EntryRef } from './citations'

type EntryPreviewPanelProps = {
  /** The cited entry to preview; `null` closes the panel. */
  entry: EntryRef | null
  /** Why the entry is shown, e.g. "Cited for Extraversion". */
  label?: string
  onClose: () => void
}

export function EntryPreviewPanel({
  entry,
  label = 'Cited entry',
  onClose,
}: EntryPreviewPanelProps) {
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
    // Portalled to <body>: a transformed or filtered ancestor (e.g. a `Rise` card) would otherwise
    // become the containing block for `position: fixed` and trap the dialog inside it.
    <Portal.Root>
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
              className="fixed inset-0 z-40 bg-neutral-900/30 backdrop-blur-[2px]"
            />
            <motion.dialog
              key="panel"
              open
              aria-modal="true"
              aria-labelledby="entry-preview-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              // `inset-0` + `m-auto` + `h-fit` centers the dialog; the body scrolls inside the height cap.
              className="fixed inset-0 z-50 m-auto flex h-fit max-h-[85dvh] w-[calc(100%-32px)] max-w-[600px] flex-col overflow-hidden rounded-[20px] border border-neutral-200 bg-surface p-0 text-inherit shadow-xl"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-6 pt-4 pb-3.5">
                <p className="text-[11px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase">
                  {label}
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
    </Portal.Root>
  )
}

function EntryPreviewBody({ entry }: { entry: EntryRef }) {
  const trpc = useTRPC()
  const [now] = useState(() => new Date())
  const query = useQuery(trpc.v1.entry.findOne.queryOptions({ id: entry.id }))
  const analysis = query.data?.analysis

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-2.5">
        {/* The editor's serif title, scaled down to suit a dialog. */}
        <h2
          id="entry-preview-title"
          className="font-serif text-[22px] leading-[1.3] font-medium text-neutral-900"
        >
          {query.data?.title ?? entry.title}
        </h2>
        {query.data && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p suppressHydrationWarning className="text-[13px] text-neutral-500">
              {formatEntryDateTime(new Date(query.data.writtenAt).toISOString(), now)}
            </p>
            {analysis && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-700">
                <MoodDot mood={analysis.mood} size={8} />
                {moodLabel[analysis.mood]}
              </span>
            )}
          </div>
        )}
        {query.data && query.data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {query.data.tags.map((tag) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </div>
        )}
      </div>

      {query.isPending && (
        <div className="flex flex-col gap-2" aria-label="Loading entry">
          <div className="h-20 w-full animate-pulse rounded-[14px] bg-neutral-100" />
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

      {analysis && (analysis.summary.length > 0 || analysis.themes.length > 0) && (
        <Rise className="flex flex-col gap-3 rounded-[14px] bg-cloud-100/60 p-4">
          <AiLabel>{"Jaden's read"}</AiLabel>
          {analysis.summary.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {analysis.summary.map((point) => (
                <li key={point} className="flex gap-2 text-[14px] leading-relaxed text-neutral-800">
                  <span
                    aria-hidden
                    className="mt-[9px] size-1 shrink-0 rounded-full bg-cloud-500"
                  />
                  {point}
                </li>
              ))}
            </ul>
          )}
          {analysis.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.themes.map((theme) => (
                <Chip key={theme} variant="cloud" className="px-2.5 py-1 text-[11px]">
                  {theme}
                </Chip>
              ))}
            </div>
          )}
        </Rise>
      )}

      {query.data && (
        <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-neutral-800">
          {query.data.body}
        </p>
      )}
    </div>
  )
}
