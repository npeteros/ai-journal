'use client'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  COMPANION_COOLDOWN_MS,
  COMPANION_PAUSE_MS,
  countWords,
  evaluateCompanionRequest,
  type CompanionTrigger,
  type PriorCompanionQuestion,
} from '@/src/lib/companion'
import { useTRPC } from '@/src/server/trpc/client'

/** Why the panel was replaced by a note: the user's budget is used up, or this entry's questions are. */
export type CompanionNote = 'limited' | 'entry_cap'

export type WritingCompanionState = {
  question: string | null
  asking: boolean
  note: CompanionNote | null
  /** True until the cooldown since the last question has passed. */
  coolingDown: boolean
}

/**
 * Drives the writing companion beside the editor (rules in src/lib/companion.ts).
 *
 * Asks automatically once typing pauses and enough new words have been written, but only while
 * no question is showing. It never touches the editor's state or focus, so typing is never
 * interrupted. The server re-checks every rule; this only avoids requests it would refuse.
 */
export function useWritingCompanion({ entryId, body }: { entryId: string | null; body: string }) {
  const trpc = useTRPC()
  const { mutateAsync } = useMutation(trpc.v1.entry.companionQuestion.mutationOptions())

  const [question, setQuestion] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState<CompanionNote | null>(null)
  const [retryAt, setRetryAt] = useState<number | null>(null)

  /** Questions asked this session, used to skip requests the server would refuse. */
  const priorRef = useRef<PriorCompanionQuestion[]>([])
  const inFlightRef = useRef(false)
  const bodyRef = useRef(body)
  const questionRef = useRef(question)
  const noteRef = useRef(note)

  useEffect(() => {
    bodyRef.current = body
    questionRef.current = question
    noteRef.current = note
  }, [body, question, note])

  const ask = useCallback(
    async (trigger: CompanionTrigger) => {
      if (entryId === null || inFlightRef.current || noteRef.current) return
      const text = bodyRef.current
      const wordCount = countWords(text)
      const local = evaluateCompanionRequest({
        now: new Date(),
        trigger,
        wordCount,
        prior: priorRef.current,
      })
      if (!local.ok) return

      inFlightRef.current = true
      setAsking(true)
      try {
        const result = await mutateAsync({ id: entryId, text, trigger })
        switch (result.status) {
          case 'ok':
            priorRef.current = [
              ...priorRef.current,
              {
                createdAt: new Date(new Date(result.retryAt).getTime() - COMPANION_COOLDOWN_MS),
                wordCount,
              },
            ]
            setRetryAt(new Date(result.retryAt).getTime())
            setQuestion(result.question)
            break
          case 'blocked':
            if (result.reason === 'entry_cap') setNote('entry_cap')
            if (result.retryAt) setRetryAt(new Date(result.retryAt).getTime())
            // The server counts questions from earlier visits too; wait for new words from here.
            if (result.reason === 'not_enough_text') {
              priorRef.current = [...priorRef.current, { createdAt: new Date(0), wordCount }]
            }
            break
          case 'limited':
            setQuestion(null)
            setNote('limited')
            break
          case 'unavailable':
            break
        }
      } catch {
        // A failed request just means no question this time; the companion stays quiet.
      } finally {
        inFlightRef.current = false
        setAsking(false)
      }
    },
    [entryId, mutateAsync],
  )

  // Automatic questions: after a pause in typing, only while no question is showing.
  useEffect(() => {
    if (entryId === null) return
    const timer = setTimeout(() => {
      if (questionRef.current !== null || document.visibilityState === 'hidden') return
      void ask('auto')
    }, COMPANION_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [body, entryId, ask])

  // Re-enables "Another question" once the cooldown has passed.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (retryAt === null) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(retryAt - Date.now(), 0))
    return () => clearTimeout(timer)
  }, [retryAt])

  const dismiss = useCallback(() => setQuestion(null), [])
  const askAnother = useCallback(() => void ask('manual'), [ask])

  const state: WritingCompanionState = {
    question,
    asking,
    note,
    coolingDown: retryAt !== null && now < retryAt,
  }
  return { ...state, dismiss, askAnother }
}
