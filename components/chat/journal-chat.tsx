'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useChat } from '@ai-sdk/react'
import { APICallError, DefaultChatTransport, isTextUIPart, isToolUIPart, type UIMessage } from 'ai'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BookOpen } from 'lucide-react'
import { cn } from 'cn'

import { JadenFor, JadenPerch, PLACEMENTS, belowEdge, heightFor } from '@/components/jaden'
import { SPRING } from '@/components/motion'
import { AiLabel, Orb } from '@/components/ui/ai'
import {
  CHAT_API,
  CHAT_CONTEXT_MESSAGES,
  CHAT_RATE_LIMITED_CODE,
  CHAT_RATE_LIMITED_MESSAGE,
} from '@/src/lib/chat'
import { collectEntryRefs, splitCitations, type EntryRef } from './citations'
import { EntryPreviewPanel } from './entry-preview-panel'

const STARTER_QUESTIONS = [
  'What themes keep coming up in my entries?',
  'How have I been feeling this past week?',
  "What's been on my mind about work lately?",
  'When did I last feel proud of myself?',
]

// How far Jaden rises above the chat input's top edge.
const PERCH_CLEARANCE = heightFor(PLACEMENTS.chat.size) - belowEdge(PLACEMENTS.chat.size)

// Chat is stateless: nothing is stored server-side, so recent turns are sent with each message.
const transport = new DefaultChatTransport<UIMessage>({
  api: CHAT_API,
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { messages: messages.slice(-CHAT_CONTEXT_MESSAGES) },
  }),
})

const bubbleIn = (from: 'left' | 'right') => ({
  initial: { opacity: 0, y: 10, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: SPRING,
  style: { transformOrigin: from === 'right' ? '100% 100%' : '0% 100%' },
})

function getText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('')
}

function isRateLimited(error: Error | undefined): string | null {
  if (!error || !APICallError.isInstance(error) || error.statusCode !== 429) return null
  try {
    const body: unknown = JSON.parse(error.responseBody ?? '')
    if (typeof body === 'object' && body !== null && 'code' in body && 'error' in body) {
      if (body.code === CHAT_RATE_LIMITED_CODE && typeof body.error === 'string') return body.error
    }
  } catch {
    // Non-JSON body: fall back to the default copy.
  }
  return CHAT_RATE_LIMITED_MESSAGE
}

/** "Chat with your journal": streams answers from the journal companion agent. */
export function JournalChat() {
  const [draft, setDraft] = useState('')
  const [preview, setPreview] = useState<EntryRef | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const endRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, regenerate, clearError, status, error } = useChat({ transport })

  const busy = status === 'submitted' || status === 'streaming'
  const refs = useMemo(() => collectEntryRefs(messages), [messages])
  const rateLimitMessage = isRateLimited(error)

  const last = messages.at(-1)
  const lastText = last ? getText(last) : ''
  const awaitingText = status === 'submitted' || (status === 'streaming' && !lastText)
  const thinking = busy && (last?.role === 'user' || awaitingText)
  const readingEntries =
    last?.role === 'assistant' &&
    last.parts.some(
      (part) =>
        isToolUIPart(part) && part.state !== 'output-available' && part.state !== 'output-error',
    )

  const hasMounted = useRef(false)
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: hasMounted.current ? 'smooth' : 'instant',
      block: 'end',
    })
    hasMounted.current = true
  }, [messages.length, lastText.length, thinking, error])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    clearError()
    void sendMessage({ text: trimmed })
    setDraft('')
  }

  function retry() {
    clearError()
    void regenerate()
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] py-4" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && !busy && (
          <StarterQuestions onPick={(question) => send(question)} />
        )}

        {messages.map((message) => {
          const text = getText(message)
          if (message.role === 'user') {
            return (
              <motion.div
                key={message.id}
                {...bubbleIn('right')}
                className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-neutral-900 px-[18px] py-3.5 text-[15px] leading-[1.55] whitespace-pre-wrap text-surface sm:max-w-[70%]"
              >
                {text}
              </motion.div>
            )
          }
          if (!text) return null
          return (
            <div
              key={message.id}
              className="flex max-w-[90%] flex-col gap-1.5 self-start sm:max-w-[78%]"
            >
              <AiLabel />
              <motion.div
                {...bubbleIn('left')}
                className="lv-card rounded-[18px_18px_18px_4px] px-[18px] py-3.5 text-[15px] leading-[1.6] whitespace-pre-wrap text-neutral-900"
              >
                <AssistantText text={text} refs={refs} onCite={setPreview} />
              </motion.div>
            </div>
          )
        })}

        <AnimatePresence>
          {thinking && (
            <motion.div
              key="typing"
              {...bubbleIn('left')}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className="flex items-center gap-2.5 self-start"
            >
              <Orb size={12} />
              <output className="lv-card flex items-center gap-2 rounded-[18px_18px_18px_4px] px-4 py-3">
                <span className="lv-typing" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="text-[12px] leading-none font-medium text-neutral-400">
                  {readingEntries ? 'reading your entries' : 'thinking'}
                </span>
              </output>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div
            role="alert"
            className="flex max-w-[90%] flex-col gap-2 self-start rounded-[18px] border border-neutral-200 bg-surface px-[18px] py-3.5 text-[14px] leading-normal text-neutral-600 sm:max-w-[78%]"
          >
            {rateLimitMessage ?? "Something went wrong and JADEN couldn't answer."}
            {!rateLimitMessage && (
              <button
                type="button"
                onClick={retry}
                className="self-start text-[13px] font-semibold text-cloud-700 hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {/* Reserves room for Jaden perched on the input so he never covers the last message. */}
        <div
          ref={endRef}
          className="shrink-0 sm:h-[var(--perch-clearance)]"
          style={{ '--perch-clearance': `${PERCH_CLEARANCE}px` } as CSSProperties}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 -mx-5 flex items-center gap-3 border-t border-neutral-200 bg-[var(--lv-card-bg)] px-5 py-3.5 backdrop-blur-[18px] sm:-mx-8 sm:px-8 lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-5 lg:pb-10 lg:backdrop-blur-none lg:bottom-0"
      >
        <div className="relative flex-1">
          <JadenPerch
            width={PLACEMENTS.chat.size}
            position={{ left: 28 }}
            className="hidden sm:block"
          >
            <JadenFor placement="chat" />
          </JadenPerch>
          <label htmlFor="chat-input" className="sr-only">
            Ask your journal anything
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask your journal anything…"
            autoComplete="off"
            maxLength={2000}
            className="h-[52px] w-full rounded-[26px] border border-neutral-200 bg-surface px-5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || busy}
          className={cn(
            'flex size-[52px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-surface transition-[transform,opacity] duration-300 ease-spring hover:-translate-y-px disabled:opacity-60',
          )}
        >
          <ArrowRight className="size-[19px]" strokeWidth={2} />
        </button>
      </form>

      <EntryPreviewPanel entry={preview} onClose={closePreview} />
    </>
  )
}

function StarterQuestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex flex-col gap-3 self-start">
      <AiLabel />
      <p className="text-[15px] leading-[1.6] text-neutral-600">
        Ask me anything about what you&apos;ve written. A few ideas to start:
      </p>
      <ul className="flex flex-wrap gap-2">
        {STARTER_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="rounded-full border border-neutral-200 bg-surface px-4 py-2 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-400"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Assistant text with entry citations rendered as chips that open a preview panel.
 * Chat history lives only in memory, so citations must not navigate away from the page.
 */
function AssistantText({
  text,
  refs,
  onCite,
}: {
  text: string
  refs: EntryRef[]
  onCite: (entry: EntryRef) => void
}) {
  return splitCitations(text, refs).map((segment, i) =>
    segment.type === 'text' ? (
      <span key={i}>{segment.text}</span>
    ) : (
      <button
        key={i}
        type="button"
        onClick={() => onCite(segment.entry)}
        aria-haspopup="dialog"
        className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 align-baseline text-[13px] font-semibold text-cloud-700 hover:underline"
      >
        <BookOpen className="size-3.5" aria-hidden />
        {segment.entry.title}
        <span className="font-normal text-neutral-400">· {segment.entry.date}</span>
      </button>
    ),
  )
}
