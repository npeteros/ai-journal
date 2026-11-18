'use client'

import { BookOpen } from 'lucide-react'

import type { EntryRef } from './citations'

/** A cited journal entry, shown as a chip that opens `EntryPreviewPanel` instead of navigating. */
export function EntryCitationChip({
  entry,
  onOpen,
}: {
  entry: EntryRef
  onOpen: (entry: EntryRef) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      aria-haspopup="dialog"
      className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 align-baseline text-[13px] font-semibold text-cloud-700 hover:underline"
    >
      <BookOpen className="size-3.5" aria-hidden />
      {entry.title}
      <span className="font-normal text-neutral-400">· {entry.date}</span>
    </button>
  )
}
