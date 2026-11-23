'use client'

import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { BubbleIn } from '@/components/motion'
import { GlintText, Orb, TypingIndicator } from '@/components/ui/ai'
import { CHAT_RATE_LIMITED_MESSAGE } from '@/src/lib/chat'
import type { CompanionNote } from './use-writing-companion'

export const ENTRY_CAP_NOTE =
  "That's all my questions for this entry. Keep going in your own direction."

type CompanionPanelProps = {
  question: string | null
  asking: boolean
  note: CompanionNote | null
  coolingDown: boolean
  /** False until the entry has been saved once; questions need an entry. */
  ready: boolean
  onAskAnother: () => void
  onDismiss: () => void
}

const pill =
  'rounded-full border border-neutral-200 px-3.5 py-[7px] text-[12px] leading-none font-medium text-neutral-600 hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-50'

/**
 * The writing companion beside the editor. Questions appear quietly (polite live region, no focus
 * change) so typing is never interrupted. Over the limit, the card becomes a short note.
 */
export function CompanionPanel({
  question,
  asking,
  note,
  coolingDown,
  ready,
  onAskAnother,
  onDismiss,
}: CompanionPanelProps) {
  return (
    <aside aria-label="JADEN companion" className="flex w-full shrink-0 flex-col lg:w-[300px]">
      <BubbleIn from="left" i={1} className="relative mt-24">
        <JadenPerch width={PLACEMENTS.companion.size} position={{ right: 14 }}>
          <JadenFor placement="companion" />
        </JadenPerch>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-cloud-200 bg-surface p-4 shadow-lift">
          <span className="flex items-center gap-2">
            <Orb size={18} className="m-0.5" />
            <GlintText className="text-[12px] font-bold">JADEN companion</GlintText>
          </span>

          <div aria-live="polite" className="flex flex-col gap-2.5">
            {note ? (
              <p className="text-[14px] leading-normal text-neutral-600">
                {note === 'limited' ? CHAT_RATE_LIMITED_MESSAGE : ENTRY_CAP_NOTE}
              </p>
            ) : question ? (
              <p className="font-serif text-[15px] leading-normal font-medium text-neutral-900 lg:text-[17px]">
                {question}
              </p>
            ) : asking ? (
              <TypingIndicator label="Thinking of a question…" />
            ) : (
              <p className="text-[14px] leading-normal text-neutral-500">
                Keep writing. When you pause, I may offer a question to help you go deeper.
              </p>
            )}
          </div>

          {!note && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAskAnother}
                disabled={!ready || asking || coolingDown}
                className={pill}
              >
                {question ? 'Another question' : 'Ask a question'}
              </button>
              {question && (
                <button type="button" onClick={onDismiss} className={pill}>
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </BubbleIn>
    </aside>
  )
}
