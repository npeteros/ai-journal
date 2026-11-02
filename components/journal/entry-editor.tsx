'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Mic, Plus, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { formatEntryDateTime } from '@/src/lib/format'
import type { PlaceholderEntry } from '@/src/lib/placeholder/entries'
import { AiRail } from './ai-rail'

type EntryEditorProps = {
  /** Existing entry, or undefined for a new one */
  entry?: PlaceholderEntry
  /** ISO timestamp shown in the overline for new entries */
  now: string
}

/** Writing surface: title, auto-growing body, tags; AI rail beside it (below on mobile). */
export function EntryEditor({ entry, now }: EntryEditorProps) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [body, setBody] = useState(entry?.body ?? '')
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [suggested, setSuggested] = useState<string[]>(entry?.suggestedTags ?? [])
  const [adding, setAdding] = useState(false)
  const [draftTag, setDraftTag] = useState('')
  const [saved, setSaved] = useState(false)

  function addTag(tag: string) {
    const t = tag.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setSuggested((prev) => prev.filter((s) => s !== t))
  }

  function save() {
    // Placeholder: wire to the entry tRPC mutation.
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase lg:text-[13px]">
          {formatEntryDateTime(entry?.writtenAt ?? now)}
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/journal"
            className="text-[14px] font-medium text-neutral-400 hover:text-neutral-600"
          >
            Cancel
          </Link>
          <Button
            variant="ink-flat"
            size="md"
            onClick={save}
            className="min-w-[76px] px-[22px] text-[14px]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={saved ? 'saved' : 'save'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5"
              >
                {saved ? (
                  <>
                    <Check className="size-4" /> Saved
                  </>
                ) : (
                  'Save'
                )}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-10 lg:flex-row lg:gap-12">
        <div className="flex max-w-[660px] flex-1 flex-col gap-[18px]">
          <label className="sr-only" htmlFor="entry-title">
            Title
          </label>
          <input
            id="entry-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give it a title"
            className="bg-transparent font-serif text-[26px] leading-[1.3] font-medium text-neutral-900 outline-none placeholder:text-neutral-300 lg:text-[30px]"
          />
          <label className="sr-only" htmlFor="entry-body">
            Entry
          </label>
          <textarea
            id="entry-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
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
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    setDraftTag('')
                    setAdding(false)
                  }
                }}
                placeholder="Tag name"
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

        <AiRail
          moodLabel={entry ? 'Calm mood detected' : undefined}
          suggestedTags={suggested}
          onAcceptTag={addTag}
          summary={entry?.summary}
        />
      </div>
    </div>
  )
}
