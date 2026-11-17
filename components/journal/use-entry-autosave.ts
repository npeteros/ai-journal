'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { browserTimeZone } from '@/src/lib/browser-time-zone'
import { useTRPC } from '@/src/server/trpc/client'
import { getApiErrorMessage } from './api-error'

export const AUTOSAVE_DELAY_MS = 1500
/**
 * Analysis runs server-side after a 30 s debounce plus the model call, so after a save that
 * changes the body we first check once the debounce has passed, then every 5 s, for up to 90 s,
 * then give up quietly.
 *
 * Mirrors `ENTRY_ANALYSIS_DEBOUNCE_MS` in src/mastra/workflows/entry-analysis-workflow.ts, which
 * isn't imported here so Mastra stays out of the client bundle.
 */
export const ANALYSIS_FIRST_CHECK_DELAY_MS = 30_000
export const ANALYSIS_POLL_INTERVAL_MS = 5000
export const ANALYSIS_POLL_WINDOW_MS = 90_000

export type EntryDraft = { title: string; body: string; tags: string[] }
export type SavedEntry = EntryDraft & { id: string; writtenAt: string }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const snapshot = ({ title, body, tags }: EntryDraft) => JSON.stringify([title, body, tags])

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** When an entry was last analyzed (ms), or null. `analyzedAt` is a Date from the RSC cache, a string over HTTP. */
const analysisStamp = (entry: { analysis: { analyzedAt: Date | string } | null } | undefined) =>
  entry?.analysis ? new Date(entry.analysis.analyzedAt).getTime() : null

/**
 * Owns an entry's draft and keeps it saved through `v1.entry.*`.
 *
 * - The first save creates the entry and swaps the URL to `/journal/[id]`; later saves update it.
 * - Saves run one at a time and always send the latest draft, so edits made mid-save are not lost.
 * - A save is triggered ~1.5 s after typing stops, on `flush()` (blur / Save), when the tab is
 *   hidden, and when the editor unmounts. Closing the tab with unsaved changes prompts first.
 * - After a save that changes the body, polls `findOne` until the new analysis arrives
 *   (`analyzing` is true meanwhile). Read the analysis itself with `useEntryAnalysis`.
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
  // An entry saved elsewhere moments ago (e.g. drafted in a voice session) may still be being
  // analyzed when the editor opens. Read once from the hydrated cache: its save time, or null.
  const [pendingAnalysisSince] = useState<number | null>(() => {
    if (!entry) return null
    const cached = queryClient.getQueryData(trpc.v1.entry.findOne.queryKey({ id: entry.id }))
    if (!cached) return null
    const savedAt = new Date(cached.updatedAt).getTime()
    const analyzedAt = analysisStamp(cached) ?? -Infinity
    return analyzedAt < savedAt && Date.now() - savedAt <= ANALYSIS_POLL_WINDOW_MS ? savedAt : null
  })
  const [analyzing, setAnalyzing] = useState(pendingAnalysisSince !== null)
  /** Server time of the last save that changed the body; analyses older than this are stale. */
  const [bodySavedAt, setBodySavedAt] = useState<number | null>(pendingAnalysisSince)

  const draftRef = useRef(draft)
  /** Snapshot of the draft the server last confirmed; a different snapshot means unsaved edits. */
  const savedRef = useRef(snapshot(draft))
  const entryIdRef = useRef(entryId)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Set while deleting so nothing is re-saved (or re-created) behind the delete. */
  const closedRef = useRef(false)
  /** Body the server last confirmed: only a changed body triggers a new analysis. */
  const savedBodyRef = useRef(entry?.body ?? '')
  const aliveRef = useRef(true)
  /** Bumped to cancel a poll that a newer save (or a delete) has made obsolete. */
  const pollRunRef = useRef(0)
  const flushRef = useRef<(explicit?: boolean) => Promise<void>>(async () => {})

  /** Journal Home reads the list, the card moods and the week strip from these. */
  const invalidateEntryList = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries(trpc.v1.entry.findMany.pathFilter()),
        queryClient.invalidateQueries(trpc.v1.entry.weekMoods.pathFilter()),
      ]),
    [queryClient, trpc],
  )

  /**
   * Refetches the entry until it has an analysis made after `since` (the save's server time),
   * or the window runs out. Keeps going if the editor unmounts so Journal Home still picks up
   * the new mood; only a newer save or a delete cancels it.
   */
  const waitForAnalysis = useCallback(
    async (id: string, since: number) => {
      const run = ++pollRunRef.current
      const isCurrent = () => !closedRef.current && pollRunRef.current === run
      const deadline = Date.now() + ANALYSIS_POLL_WINDOW_MS

      // Nothing can arrive before the server's debounce has passed since the save, so the first
      // check waits for it. Clamped so clock skew between server and browser can't stretch it.
      let wait = Math.min(
        ANALYSIS_FIRST_CHECK_DELAY_MS,
        Math.max(ANALYSIS_POLL_INTERVAL_MS, since + ANALYSIS_FIRST_CHECK_DELAY_MS - Date.now()),
      )

      setAnalyzing(true)
      try {
        while (Date.now() < deadline) {
          await sleep(wait)
          wait = ANALYSIS_POLL_INTERVAL_MS
          if (!isCurrent()) return

          try {
            const fresh = await queryClient.fetchQuery({
              ...trpc.v1.entry.findOne.queryOptions({ id }),
              staleTime: 0,
            })
            if (!isCurrent()) return
            if ((analysisStamp(fresh) ?? -Infinity) >= since) {
              void invalidateEntryList()
              return
            }
          } catch {
            // A failed check (network blip, 5xx) just waits for the next one.
          }
        }
        // No new analysis in time (rate-limited or failed): the panel quietly goes without it.
      } finally {
        if (isCurrent() && aliveRef.current) setAnalyzing(false)
      }
    },
    [queryClient, trpc, invalidateEntryList],
  )

  // Wait for the pending analysis found on open, as if this editor had made the save. Started
  // once, after the effect (not synchronously) since `analyzing` is already initialised to true.
  const initialEntryId = entry?.id
  const pendingPollStartedRef = useRef(false)
  useEffect(() => {
    if (initialEntryId === undefined || pendingAnalysisSince === null) return
    if (pendingPollStartedRef.current) return
    pendingPollStartedRef.current = true
    queueMicrotask(() => void waitForAnalysis(initialEntryId, pendingAnalysisSince))
  }, [initialEntryId, pendingAnalysisSince, waitForAnalysis])

  /** Creating or deleting an entry can change the streak in the app shell. */
  const invalidateStats = useCallback(
    () => queryClient.invalidateQueries(trpc.v1.entry.stats.pathFilter()),
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
        let savedAt: number

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
          void invalidateStats()
          serverTitle = created.title
          savedAt = new Date(created.updatedAt).getTime()
        } else {
          const updated = await updateEntry({
            id,
            // A blank title asks the server to generate one.
            title: sent.title.trim() === '' ? null : sent.title,
            body: sent.body,
            tags: sent.tags,
          })
          serverTitle = updated.title
          savedAt = new Date(updated.updatedAt).getTime()
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

        // The server trims the body and re-analyzes only when it changed (or the entry is new).
        const savedId = entryIdRef.current
        if (savedId !== null && (id === null || sent.body.trim() !== savedBodyRef.current.trim())) {
          setBodySavedAt(savedAt)
          void waitForAnalysis(savedId, savedAt)
        }
        savedBodyRef.current = sent.body
      } catch (caught) {
        setStatus('error')
        setError(getApiErrorMessage(caught))
      }
    },
    [createEntry, updateEntry, invalidateEntryList, invalidateStats, waitForAnalysis],
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

    aliveRef.current = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      aliveRef.current = false
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
    pollRunRef.current++
    setAnalyzing(false)

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
      void invalidateStats()
      router.replace('/journal')
    } catch (caught) {
      closedRef.current = false
      setDeleting(false)
      setError(getApiErrorMessage(caught))
    }
  }, [deleteEntry, invalidateEntryList, invalidateStats, queryClient, router, trpc])

  return {
    draft,
    update,
    status,
    error,
    entryId,
    writtenAt,
    deleting,
    /** True while waiting for a fresh analysis after a save. */
    analyzing,
    /** Server time (ms) of the last body-changing save, or null if none this session. */
    bodySavedAt,
    /** Explicit Save: always asks the API, so validation errors (e.g. empty body) are shown. */
    save: () => flush(true),
    /** Blur: save now if anything changed. */
    flush: () => flush(),
    remove,
  }
}
