'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Mic, Plus, Sparkles, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { formatEntryDateTime } from '@/src/lib/format'
import { TAG_NAME_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/src/server/api/routers/v1/entry/schema'
import { AiRail } from './ai-rail'
import { useEntryAutosave, type SavedEntry } from './use-entry-autosave'

type EntryEditorProps = {
  /** Existing entry, or undefined for a new one */
  entry?: SavedEntry
}

const NO_SUGGESTIONS: string[] = []

/** Writing surface: title, auto-growing body, tags; AI rail beside it (below on mobile). */
export function EntryEditor({ entry }: EntryEditorProps) {
  const { draft, update, status, error, entryId, writtenAt, deleting, save, flush, remove } =
    useEntryAutosave(entry)
  const { title, body, tags } = draft

  const [openedAt] = useState(() => new Date())
  const [adding, setAdding] = useState(false)
  const [draftTag, setDraftTag] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function addTag(tag: string) {
    const t = tag.trim()
    if (t && !tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
      update({ tags: [...tags, t] })
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* Rendered from the browser's clock and time zone, so it can differ from the server's */}
        <p
          suppressHydrationWarning
          className="text-[12px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase lg:text-[13px]"
        >
          {formatEntryDateTime(writtenAt ?? openedAt.toISOString(), openedAt)}
        </p>
        {confirmingDelete ? (
          <fieldset className="m-0 flex min-w-0 items-center gap-4 border-0 p-0">
            <legend className="sr-only">Confirm delete</legend>
            <span className="text-[14px] font-medium text-neutral-600">Delete this entry?</span>
            <Button
              variant="danger"
              size="md"
              onClick={remove}
              disabled={deleting}
              className="px-[18px] text-[14px]"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="text-[14px] font-medium text-neutral-400 hover:text-neutral-600"
            >
              Keep
            </button>
          </fieldset>
        ) : (
          <div className="flex items-center gap-4">
            <span
              aria-live="polite"
              className="inline-flex min-w-[76px] justify-end text-[13px] font-medium text-neutral-400"
            >
              <AnimatePresence mode="wait" initial={false}>
                {status === 'saving' && (
                  <motion.span
                    key="saving"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    Saving…
                  </motion.span>
                )}
                {status === 'saved' && (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Check className="size-4" /> Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            {entryId && (
              <button
                type="button"
                aria-label="Delete entry"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <Link
              href="/journal"
              className="text-[14px] font-medium text-neutral-400 hover:text-neutral-600"
            >
              Done
            </Link>
            <Button
              variant="ink-flat"
              size="md"
              onClick={() => void save()}
              disabled={status === 'saving'}
              className="min-w-[76px] px-[22px] text-[14px]"
            >
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-10 lg:flex-row lg:gap-12">
        <div className="flex max-w-[660px] flex-1 flex-col gap-[18px]">
          <label className="sr-only" htmlFor="entry-title">
            Title
          </label>
          <input
            id="entry-title"
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => void flush()}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="Give it a title"
            className="bg-transparent font-serif text-[26px] leading-[1.3] font-medium text-neutral-900 outline-none placeholder:text-neutral-300 lg:text-[30px]"
          />
          <label className="sr-only" htmlFor="entry-body">
            Entry
          </label>
          <textarea
            id="entry-body"
            value={body}
            onChange={(e) => update({ body: e.target.value })}
            onBlur={() => void flush()}
            placeholder="What's on your mind?"
            className="field-sizing-content min-h-[120px] resize-none bg-transparent text-[17px] leading-[1.8] text-neutral-900 caret-cloud-500 outline-none placeholder:text-neutral-400"
          />

          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            {tags.map((t) => (
              <Chip key={t} className="px-3.5 py-[7px] text-[13px]">
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => update({ tags: tags.filter((x) => x !== t) })}
                  className="-mr-1 rounded-full p-0.5 text-neutral-400 hover:text-neutral-900"
                >
                  <X className="size-3" strokeWidth={2.4} />
                </button>
              </Chip>
            ))}
            {adding ? (
              <input
                // Focus the tag field as soon as it opens
                ref={(el) => el?.focus()}
                value={draftTag}
                onChange={(e) => setDraftTag(e.target.value)}
                onBlur={() => {
                  addTag(draftTag)
                  setDraftTag('')
                  setAdding(false)
                  void flush()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    setDraftTag('')
                    setAdding(false)
                  }
                }}
                placeholder="Tag name"
                maxLength={TAG_NAME_MAX_LENGTH}
                aria-label="New tag"
                className="h-[29px] w-28 rounded-full border border-neutral-300 bg-surface px-3.5 text-[13px] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-[7px] text-[13px] leading-none font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                <Plus className="size-[13px]" strokeWidth={2} />
                Add tag
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {error}
            </p>
          )}
          <div
            className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-4"
            aria-label="Writing tools"
          >
            {[
              { href: '/journal/voice', label: 'Talk with JADEN', Icon: Mic },
              { href: '/journal/companion', label: 'Ask JADEN', Icon: Sparkles },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Icon className="size-3.5" strokeWidth={2} />
                {label}
              </Link>
            ))}
          </div>
        </div>

        <AiRail suggestedTags={NO_SUGGESTIONS} onAcceptTag={addTag} />
      </div>
    </div>
  )
}
