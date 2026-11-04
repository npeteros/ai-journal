'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'

import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { SPRING } from '@/components/motion'
import { AiLabel, Orb } from '@/components/ui/ai'
import type { PlaceholderChatMessage } from '@/src/lib/placeholder/chat'

const PLACEHOLDER_REPLY =
  "I'm only a preview right now — once I'm connected, I'll answer from your own entries."

const bubbleIn = (from: 'left' | 'right', i: number) => ({
  initial: { opacity: 0, y: 10, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { ...SPRING, delay: i * 0.26 + 0.2 },
  style: { transformOrigin: from === 'right' ? '100% 100%' : '0% 100%' },
})

/**
 * Chat with your journal (placeholder): renders the mock conversation; sending appends the
 * message, shows JADEN "reading", then a canned reply. Wire to the Mastra chat agent later
 * (see app/dev/chat for the streaming pattern).
 */
export function JournalChat({
  initialMessages,
  typingLabel,
}: {
  initialMessages: PlaceholderChatMessage[]
  typingLabel: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialCount = initialMessages.length

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (messages.length > initialCount)
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, thinking, initialCount])

  function send() {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [...prev, { id: `u${prev.length}`, role: 'user', text }])
    setDraft('')
    setThinking(true)
    timer.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `a${prev.length}`, role: 'assistant', text: PLACEHOLDER_REPLY },
      ])
      setThinking(false)
    }, 1800)
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] py-4" aria-live="polite">
        {messages.map((m, i) => {
          const stagger = i < initialCount ? i : 0
          return m.role === 'user' ? (
            <motion.div
              key={m.id}
              {...bubbleIn('right', stagger)}
              className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-neutral-900 px-[18px] py-3.5 text-[15px] leading-[1.55] text-surface sm:max-w-[70%]"
            >
              {m.text}
            </motion.div>
          ) : (
            <div key={m.id} className="flex max-w-[90%] flex-col gap-1.5 self-start sm:max-w-[78%]">
              <AiLabel />
              <motion.div
                {...bubbleIn('left', stagger)}
                className="lv-card rounded-[18px_18px_18px_4px] px-[18px] py-3.5 text-[15px] leading-[1.6] text-neutral-900"
              >
                {m.text}
              </motion.div>
            </div>
          )
        })}

        <AnimatePresence>
          {thinking && (
            <motion.div
              key="typing"
              {...bubbleIn('left', messages.length === initialCount ? initialCount : 0)}
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
                  {typingLabel}
                </span>
              </output>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
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
            className="h-[52px] w-full rounded-[26px] border border-neutral-200 bg-surface px-5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className={cn(
            'flex size-[52px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-surface transition-[transform,opacity] duration-300 ease-spring hover:-translate-y-px disabled:opacity-60',
          )}
        >
          <ArrowRight className="size-[19px]" strokeWidth={2} />
        </button>
      </form>
    </>
  )
}
