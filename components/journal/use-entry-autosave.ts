'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { browserTimeZone } from '@/src/lib/browser-time-zone'
import { useTRPC } from '@/src/server/trpc/client'
import { getApiErrorMessage } from './api-error'

export const AUTOSAVE_DELAY_MS = 1500

export type EntryDraft = { title: string; body: string; tags: string[] }
export type SavedEntry = EntryDraft & { id: string; writtenAt: string }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const snapshot = ({ title, body, tags }: EntryDraft) => JSON.stringify([title, body, tags])

/**
 * Owns an entry's draft and keeps it saved through `v1.entry.*`.
 *
 * - The first save creates the entry and swaps the URL to `/journal/[id]`; later saves update it.
 * - Saves run one at a time and always send the latest draft, so edits made mid-save are not lost.
 * - A save is triggered ~1.5 s after typing stops, on `flush()` (blur / Save), when the tab is
 *   hidden, and when the editor unmounts. Closing the tab with unsaved changes prompts first.
 */
export function useEntryAutosave(entry?: SavedEntry, delayMs = AUTOSAVE_DELAY_MS) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { mutateAsync: createEntry } = useMutation(trpc.v1.entry.create.mutationOptions())
  const { mutateAsync: updateEntry } = useMutation(trpc.v1.entry.update.mutationOptions())
  const { mutateAsync: deleteEntry } = useMutation(trpc.v1.entry.delete.mutationOptions())

  const [draft, setDraft] = useState<EntryDraft>(() => ({
    title: entry?.title ?? '',
    body: entry?.body ?? '',
    tags: entry?.tags ?? [],
  }))
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [entryId, setEntryId] = useState<string | null>(entry?.id ?? null)
  const [writtenAt, setWrittenAt] = useState<string | null>(entry?.writtenAt ?? null)
  const [deleting, setDeleting] = useState(false)

  const draftRef = useRef(draft)
  /** Snapshot of the draft the server last confirmed; a different snapshot means unsaved edits. */
  const savedRef = useRef(snapshot(draft))
  const entryIdRef = useRef(entryId)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Set while deleting so nothing is re-saved (or re-created) behind the delete. */
  const closedRef = useRef(false)
  const flushRef = useRef<(explicit?: boolean) => Promise<void>>(async () => {})

  const invalidateEntryList = useCallback(
    () => queryClient.invalidateQueries(trpc.v1.entry.findMany.pathFilter()),
    [queryClient, trpc],
  )

  const saveOnce = useCallback(
    async (explicit: boolean) => {
      if (closedRef.current) return

      const sent = draftRef.current
      if (snapshot(sent) === savedRef.current) return

      const id = entryIdRef.current
      // Nothing worth creating yet. Only an explicit Save asks the API, to surface its error.
      if (id === null && sent.body.trim() === '' && !explicit) return

      setStatus('saving')
      setError(null)

      try {
        let serverTitle: string

        if (id === null) {
          const created = await createEntry({
            title: sent.title,
            body: sent.body,
            tags: sent.tags,
            timeZone: browserTimeZone(),
          })
          entryIdRef.current = created.id
          setEntryId(created.id)
          setWrittenAt(new Date(created.writtenAt).toISOString())
          // replaceState (not router.replace) keeps this editor mounted, so focus and the
          // cursor stay put while the user keeps typing.
          window.history.replaceState(null, '', `/journal/${created.id}`)
          serverTitle = created.title
        } else {
          const updated = await updateEntry({
            id,
            // A blank title asks the server to generate one.
            title: sent.title.trim() === '' ? null : sent.title,
            body: sent.body,
            tags: sent.tags,
          })
          serverTitle = updated.title
        }

        // When the title was left blank the server filled one in. Show it, and send it from now
        // on so later saves don't ask for a new generated title each time.
        const titleWasBlank = sent.title.trim() === ''
        savedRef.current = snapshot({ ...sent, title: titleWasBlank ? serverTitle : sent.title })
        if (titleWasBlank && draftRef.current.title.trim() === '') {
          draftRef.current = { ...draftRef.current, title: serverTitle }
          setDraft(draftRef.current)
        }

        const stillDirty = snapshot(draftRef.current) !== savedRef.current
        setStatus(stillDirty ? 'idle' : 'saved')
        void invalidateEntryList()
      } catch (caught) {
        setStatus('error')
        setError(getApiErrorMessage(caught))
      }
    },
    [createEntry, updateEntry, invalidateEntryList],
  )

  /** Saves now (cancelling the debounce). Queued behind any save already in flight. */
  const flush = useCallback(
    (explicit = false) => {
      clearTimeout(timerRef.current)
      queueRef.current = queueRef.current.then(() => saveOnce(explicit))
      return queueRef.current
    },
    [saveOnce],
  )

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const update = useCallback(
    (patch: Partial<EntryDraft>) => {
      if (closedRef.current) return
      draftRef.current = { ...draftRef.current, ...patch }
      setDraft(draftRef.current)
      setStatus((current) => (current === 'saved' ? 'idle' : current))
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void flushRef.current(), delayMs)
    },
    [delayMs],
  )

  useEffect(() => {
    const isDirty = () => snapshot(draftRef.current) !== savedRef.current

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    // Closing or reloading the tab can't wait for a request, so ask the user to stay instead.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty()) event.preventDefault()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
      clearTimeout(timerRef.current)
      // Leaving through in-app navigation: save whatever is pending.
      void flushRef.current()
    }
  }, [])

  const remove = useCallback(async () => {
    clearTimeout(timerRef.current)
    // Let a save already in flight finish so we know the entry's id before deleting it.
    await queueRef.current
    closedRef.current = true

    const id = entryIdRef.current
    if (id === null) {
      router.replace('/journal')
      return
    }

    setDeleting(true)
    setError(null)
    try {
      await deleteEntry({ id })
      queryClient.removeQueries(trpc.v1.entry.findOne.queryFilter({ id }))
      void invalidateEntryList()
      router.replace('/journal')
    } catch (caught) {
      closedRef.current = false
      setDeleting(false)
      setError(getApiErrorMessage(caught))
    }
  }, [deleteEntry, invalidateEntryList, queryClient, router, trpc])

  return {
    draft,
    update,
    status,
    error,
    entryId,
    writtenAt,
    deleting,
    /** Explicit Save: always asks the API, so validation errors (e.g. empty body) are shown. */
    save: () => flush(true),
    /** Blur: save now if anything changed. */
    flush: () => flush(),
    remove,
  }
}
