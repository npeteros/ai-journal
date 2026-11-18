'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'

import type { EntryRef } from '@/components/chat/citations'
import { EntryCitationChip } from '@/components/chat/entry-citation-chip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export type EvidenceEntry = { id: string; title: string; entryDate: string | Date }

export type EvidencePreview = { entry: EntryRef; label: string }

// Matches the chat citation format (YYYY-MM-DD) so the shared chip reads the same everywhere.
export function toEntryRef(entry: EvidenceEntry): EntryRef {
  return {
    id: entry.id,
    title: entry.title,
    date: new Date(entry.entryDate).toISOString().slice(0, 10),
  }
}

/**
 * A quiet, collapsible row for an insight backed by journal entries: `summary` on the left,
 * `aside` and a chevron on the right, and the entry chips revealed when opened. Chips open the
 * shared entry dialog labelled "Cited for <citedFor>".
 */
export function EvidenceRow({
  summary,
  aside,
  entries,
  citedFor,
  onOpen,
  className,
}: {
  summary: ReactNode
  aside?: ReactNode
  entries: EvidenceEntry[]
  citedFor: string
  onOpen: (preview: EvidencePreview) => void
  className?: string
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        disabled={entries.length === 0}
        className={cn(
          'group flex w-full cursor-pointer items-center justify-between gap-4 py-2.5 text-left disabled:cursor-default',
          className,
        )}
      >
        {summary}
        <span className="flex shrink-0 items-center gap-2 text-[13px] text-neutral-400 group-hover:text-neutral-600">
          {aside}
          {entries.length > 0 && (
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-wrap gap-y-1.5 pb-3">
        {entries.map((entry) => (
          <EntryCitationChip
            key={entry.id}
            entry={toEntryRef(entry)}
            onOpen={(ref) => onOpen({ entry: ref, label: `Cited for ${citedFor}` })}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
