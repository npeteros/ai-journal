'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Mic, MicOff, PhoneOff, X } from 'lucide-react'
import { cn } from 'cn'

import {
  Jaden,
  JadenPerch,
  PLACEMENTS,
  type JadenGesture,
  type JadenMood,
} from '@/components/jaden'
import { SPRING } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Orb, TypingIndicator } from '@/components/ui/ai'
import type { VoiceTurn } from '@/src/lib/placeholder/entries'

/** Waveform bar heights; hue sweeps cloud → lilac → amber. */
const WAVE = [
  10, 20, 33, 28, 29, 18, 12, 25, 27, 32, 23, 14, 17, 31, 29, 29, 24, 12, 21, 29, 39, 25, 22, 11,
]
/** How long each scripted turn "plays" before the next one. */
const TURN_MS = 3400
const DRAFT_MS = 2200

type Phase = 'speaking' | 'listening' | 'muted' | 'drafting' | 'drafted'

const STATUS: Record<Phase, string> = {
  speaking: 'JADEN is speaking',
  listening: 'Listening…',
  muted: 'Muted',
  drafting: 'Drafting your entry',
  drafted: 'Your draft is ready',
}

const JADEN_STATE: Record<Phase, { mood: JadenMood; gesture?: JadenGesture }> = {
  speaking: { mood: 'happy' },
  listening: { mood: 'curious', gesture: 'nod' },
  muted: { mood: 'neutral' },
  drafting: { mood: 'thinking', gesture: 'think' },
  drafted: { mood: 'proud' },
}

type VoiceSessionProps = {
  turns: VoiceTurn[]
  draft: { title: string; body: string; tags: string[] }
}

/**
 * Guided voice journaling (placeholder). A timer walks through a scripted conversation to show the
 * call states; swap it for a realtime AI voice model's events (JADEN speaking, user speaking, end of
 * turn) and keep the layout. Ending the session hands the conversation to JADEN to draft an entry.
 */
export function VoiceSession({ turns, draft }: VoiceSessionProps) {
  const [index, setIndex] = useState(0)
  const [muted, setMuted] = useState(false)
  const [ended, setEnded] = useState<'drafting' | 'drafted' | null>(null)

  const current = turns[index]
  const phase: Phase =
    ended ?? (muted ? 'muted' : current?.role === 'jaden' ? 'speaking' : 'listening')
  const active = phase === 'speaking' || phase === 'listening'
  const jaden = JADEN_STATE[phase]

  // Advance the scripted conversation while the session is live.
  useEffect(() => {
    if (ended || muted || index >= turns.length - 1) return
    const t = setTimeout(() => setIndex((i) => i + 1), TURN_MS)
    return () => clearTimeout(t)
  }, [index, muted, ended, turns.length])

  // "Drafting" → "drafted" once the session ends.
  useEffect(() => {
    if (ended !== 'drafting') return
    const t = setTimeout(() => setEnded('drafted'), DRAFT_MS)
    return () => clearTimeout(t)
  }, [ended])

  const visible = turns.slice(Math.max(0, index - 2), index + 1)

  return (
    <div className="relative isolate flex min-h-[680px] w-full max-w-[560px] flex-1 flex-col justify-end overflow-hidden rounded-[28px] bg-ink lg:max-h-[820px]">
      <div
        aria-hidden
        className="lv-spin absolute -top-40 -left-28 -z-10 size-[620px] rounded-full blur-[60px]"
        style={{
          background:
            'conic-gradient(from 90deg, oklch(55% 0.12 255 / .55), oklch(55% 0.12 305 / .4), oklch(65% 0.13 55 / .45), oklch(55% 0.12 255 / .55))',
        }}
      />
      <Link
        href="/journal"
        aria-label="Close voice session"
        className="absolute top-6 right-5 flex size-8 items-center justify-center rounded-full bg-[oklch(30%_0.01_75/.5)] text-on-ink"
      >
        <X className="size-3.5" strokeWidth={2.2} />
      </Link>

      {/* Rolling transcript on the dark panel */}
      <ol
        aria-live="polite"
        aria-label="Conversation"
        className="flex flex-1 flex-col justify-end gap-2.5 px-6 pt-16 pb-[128px]"
      >
        <AnimatePresence initial={false}>
          {!ended &&
            visible.map((t, i) => {
              const latest = i === visible.length - 1
              return (
                <motion.li
                  key={`${index - visible.length + 1 + i}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: latest ? 1 : 0.45, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING}
                  className={cn(
                    'max-w-[85%] text-[15px] leading-relaxed',
                    t.role === 'jaden'
                      ? 'self-start font-serif text-[17px] text-on-ink italic'
                      : 'self-end text-right text-[oklch(85%_0.02_260)]',
                  )}
                >
                  <span className="sr-only">{t.role === 'jaden' ? 'JADEN: ' : 'You: '}</span>
                  {t.text}
                </motion.li>
              )
            })}
        </AnimatePresence>
      </ol>

      <div className="relative flex flex-col items-center gap-5 rounded-t-[28px] bg-surface px-7 pt-9 pb-8 shadow-lift">
        <JadenPerch width={PLACEMENTS.voice.size} position={{ right: 24 }}>
          <Jaden
            size={PLACEMENTS.voice.size}
            entrance="arrive"
            mug={false}
            mood={jaden.mood}
            gesture={jaden.gesture}
          />
        </JadenPerch>

        <output className="text-[12px] font-bold tracking-[0.08em] text-neutral-400 uppercase">
          {STATUS[phase]}
        </output>

        {ended === 'drafted' ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING}
            className="flex w-full flex-col gap-2 rounded-2xl border border-cloud-200 bg-surface p-4 text-left"
          >
            <p className="font-serif text-[19px] font-semibold text-neutral-900">{draft.title}</p>
            <p className="text-[14px] leading-relaxed text-neutral-600">{draft.body}</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </motion.div>
        ) : ended === 'drafting' ? (
          <div className="flex h-[156px] items-center">
            <TypingIndicator label="Turning your conversation into an entry" />
          </div>
        ) : (
          <>
            <div className="relative flex size-28 items-center justify-center">
              {phase === 'listening' &&
                ['cloud-500', 'lilac-500', 'amber-500'].map((c, i) => (
                  <span
                    key={c}
                    aria-hidden
                    className="lv-ripple absolute inset-0 rounded-full border-2"
                    style={{ borderColor: `var(--${c})`, '--i': i } as CSSProperties}
                  />
                ))}
              <motion.span
                className="relative flex size-[72px] items-center justify-center"
                animate={{
                  scale: phase === 'speaking' ? [1, 1.08, 1] : 1,
                  opacity: muted ? 0.55 : 1,
                }}
                transition={
                  phase === 'speaking' ? { duration: 1.2, repeat: Infinity } : { duration: 0.3 }
                }
              >
                <Orb size={72} className="absolute inset-0" />
                {muted ? (
                  <MicOff className="relative size-[26px] text-white" strokeWidth={2} />
                ) : (
                  <Mic className="relative size-[26px] text-white" strokeWidth={2} />
                )}
              </motion.span>
            </div>

            <div className="flex h-11 items-center gap-1" aria-hidden>
              {WAVE.map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1 rounded-[3px] transition-[height,opacity] duration-300',
                    active && 'lv-wave',
                  )}
                  style={
                    {
                      height: active ? h : 4,
                      opacity: active ? 1 : 0.4,
                      background: `oklch(64% 0.13 ${(255 + i * 6.7) % 360})`,
                      '--i': i,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </>
        )}

        {ended === 'drafted' ? (
          <div className="flex w-full flex-col gap-2.5">
            <Button asChild variant="ink" size="cta-lg" className="w-full">
              <Link href="/journal/new">Review in editor</Link>
            </Button>
            <Button
              asChild
              variant="link-cloud"
              className="self-center text-[13px] text-neutral-400"
            >
              <Link href="/journal">Discard</Link>
            </Button>
          </div>
        ) : ended ? null : (
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              disabled={!!ended}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex size-[52px] shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40',
                muted
                  ? 'border-neutral-900 bg-neutral-900 text-surface'
                  : 'border-neutral-200 bg-surface text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <Button
              variant="ink"
              size="cta-lg"
              className="flex-1"
              disabled={!!ended}
              onClick={() => setEnded('drafting')}
            >
              <PhoneOff className="size-[18px]" />
              End session
            </Button>
          </div>
        )}

        <p className="text-center text-[11px] leading-snug text-neutral-400">
          Voice sessions are processed by cloud AI and logged in your{' '}
          <Link
            href="/settings/data-privacy"
            className="font-semibold text-cloud-700 hover:underline"
          >
            Processing Log
          </Link>
          . Never used to train models.
        </p>
      </div>
    </div>
  )
}
