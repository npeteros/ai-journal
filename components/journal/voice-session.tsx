'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isTextUIPart, type UIMessage } from 'ai'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Keyboard, Mic, MicOff, PhoneOff, X } from 'lucide-react'
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
import { Orb, TypingIndicator } from '@/components/ui/ai'
import { browserTimeZone } from '@/src/lib/browser-time-zone'
import { chatRateLimitMessage } from '@/src/lib/chat'
import {
  VOICE_CHAT_API,
  VOICE_CHAT_CONTEXT_MESSAGES,
  VOICE_LIMIT_MESSAGE,
  VOICE_UNAVAILABLE_MESSAGE,
  type VoiceTurn,
} from '@/src/lib/voice'
import { fitTranscript, hasUserWords } from '@/src/lib/voice-transcript'
import { useTRPC } from '@/src/server/trpc/client'
import { getApiErrorMessage } from './api-error'
import { useLiveVoiceSession, type LiveVoiceError } from './use-live-voice-session'

/** Waveform bar heights; hue sweeps cloud → lilac → amber. */
const WAVE = [
  10, 20, 33, 28, 29, 18, 12, 25, 27, 32, 23, 14, 17, 31, 29, 29, 24, 12, 21, 29, 39, 25, 22, 11,
]
const TYPED_TURN_MAX_LENGTH = 2000

type Look =
  | 'ready'
  | 'connecting'
  | 'speaking'
  | 'listening'
  | 'muted'
  | 'typing'
  | 'drafting'
  | 'drafted'
  | 'problem'

const JADEN_STATE: Record<Look, { mood: JadenMood; gesture?: JadenGesture }> = {
  ready: { mood: 'happy' },
  connecting: { mood: 'curious' },
  speaking: { mood: 'happy' },
  listening: { mood: 'curious', gesture: 'nod' },
  muted: { mood: 'neutral' },
  typing: { mood: 'curious' },
  drafting: { mood: 'thinking', gesture: 'think' },
  drafted: { mood: 'proud' },
  problem: { mood: 'neutral' },
}

const VOICE_ERRORS: Record<LiveVoiceError, string> = {
  'mic-denied':
    "Microphone access is blocked. Allow it in your browser's site settings to talk with JADEN, or keep going by typing.",
  'mic-unavailable': "JADEN couldn't find a microphone. You can keep going by typing instead.",
  limit: VOICE_LIMIT_MESSAGE,
  unavailable: VOICE_UNAVAILABLE_MESSAGE,
  'connection-lost':
    'The connection to JADEN dropped. Nothing you said is lost; you can keep going by typing.',
}

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

type Stage =
  { name: 'voice' } | { name: 'typing'; seed: VoiceTurn[] } | { name: 'draft'; turns: VoiceTurn[] }

type VoiceSessionProps = { firstName: string | null }

/**
 * Guided voice journaling. JADEN talks with the user over GPT-Live; when the conversation ends,
 * the user's side becomes a draft entry they review and save. If voice isn't available (no mic,
 * connection lost, voice budget used up) the same conversation continues by typing.
 * Audio is never recorded or stored: only the transcript is kept, in memory, until saved.
 */
export function VoiceSession({ firstName }: VoiceSessionProps) {
  const [chosenStage, setStage] = useState<Stage>({ name: 'voice' })
  const voice = useLiveVoiceSession()

  // A spoken session that ends normally goes straight to drafting.
  const stage: Stage =
    chosenStage.name === 'voice' && voice.phase === 'ended' && hasUserWords(voice.turns)
      ? { name: 'draft', turns: voice.turns }
      : chosenStage

  if (stage.name === 'typing') {
    return (
      <TypingConversation
        seed={stage.seed}
        firstName={firstName}
        onFinish={(turns) => setStage({ name: 'draft', turns })}
      />
    )
  }
  if (stage.name === 'draft') {
    return (
      <DraftReview
        turns={stage.turns}
        onKeepTalking={() => setStage({ name: 'typing', seed: stage.turns })}
      />
    )
  }

  const typeInstead = () => setStage({ name: 'typing', seed: voice.turns })
  const live = voice.phase === 'live'
  const look: Look =
    voice.phase === 'idle'
      ? 'ready'
      : voice.phase === 'starting' || voice.phase === 'ending'
        ? 'connecting'
        : voice.phase === 'failed' || voice.phase === 'ended'
          ? 'problem'
          : voice.muted
            ? 'muted'
            : voice.jadenSpeaking
              ? 'speaking'
              : 'listening'

  const status =
    look === 'ready'
      ? 'Ready when you are'
      : voice.phase === 'starting'
        ? 'Connecting to JADEN…'
        : voice.phase === 'ending'
          ? 'Wrapping up…'
          : look === 'problem'
            ? 'Voice session stopped'
            : `${look === 'speaking' ? 'JADEN is speaking' : look === 'muted' ? 'Muted' : 'Listening…'} · ${formatClock(voice.remainingSeconds)} left`

  const problem =
    voice.phase === 'failed' && voice.error
      ? VOICE_ERRORS[voice.error]
      : voice.phase === 'ended'
        ? "JADEN didn't catch anything to turn into an entry. Try again, or keep going by typing."
        : null

  return (
    <VoiceShell turns={voice.turns} look={look} status={status}>
      {look === 'ready' ? (
        <>
          <p className="text-center text-[14px] leading-relaxed text-neutral-600">
            Talk it through with JADEN. When you&apos;re done, your side of the conversation becomes
            a draft entry you can edit. JADEN uses your microphone only during the session; audio is
            never recorded or stored, only the transcript.
          </p>
          <div className="flex w-full flex-col gap-2.5">
            <Button
              variant="ink"
              size="cta-lg"
              className="w-full"
              onClick={() => void voice.start()}
            >
              <Mic className="size-[18px]" />
              Start talking
            </Button>
            <TypeInsteadLink onClick={typeInstead} />
          </div>
        </>
      ) : problem ? (
        <>
          <Alert>{problem}</Alert>
          <div className="flex w-full flex-col gap-2.5">
            <Button variant="ink" size="cta-lg" className="w-full" onClick={typeInstead}>
              <Keyboard className="size-[18px]" />
              Continue by typing
            </Button>
            {voice.error === 'connection-lost' && hasUserWords(voice.turns) ? (
              <Button
                variant="link-cloud"
                className="self-center text-[13px]"
                onClick={() => setStage({ name: 'draft', turns: voice.turns })}
              >
                Draft what we have
              </Button>
            ) : voice.error !== 'limit' && voice.error !== 'mic-denied' ? (
              <Button
                variant="link-cloud"
                className="self-center text-[13px]"
                onClick={() => void voice.start()}
              >
                Try voice again
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <VoiceMeter look={look} muted={voice.muted} />
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={voice.toggleMute}
              disabled={!live}
              aria-pressed={voice.muted}
              aria-label={voice.muted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex size-[52px] shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40',
                voice.muted
                  ? 'border-neutral-900 bg-neutral-900 text-surface'
                  : 'border-neutral-200 bg-surface text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {voice.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <Button
              variant="ink"
              size="cta-lg"
              className="flex-1"
              disabled={!live}
              onClick={() => void voice.end()}
            >
              <PhoneOff className="size-[18px]" />
              End session
            </Button>
          </div>
        </>
      )}
    </VoiceShell>
  )
}

const turnsToMessages = (turns: VoiceTurn[]): UIMessage[] =>
  turns.map((turn, i) => ({
    id: `seed-${i}`,
    role: turn.role === 'user' ? 'user' : 'assistant',
    parts: [{ type: 'text', text: turn.text }],
  }))

const messagesToTurns = (messages: UIMessage[]): VoiceTurn[] =>
  messages
    .map((message) => ({
      role: message.role === 'user' ? ('user' as const) : ('jaden' as const),
      text: message.parts
        .filter(isTextUIPart)
        .map((part) => part.text)
        .join('')
        .trim(),
    }))
    .filter((turn) => turn.text !== '')

const typingTransport = new DefaultChatTransport<UIMessage>({
  api: VOICE_CHAT_API,
  prepareSendMessagesRequest: ({ messages }) => ({
    body: { messages: messages.slice(-VOICE_CHAT_CONTEXT_MESSAGES) },
  }),
})

/** The same guided conversation, typed. Picks up any spoken turns so far. */
function TypingConversation({
  seed,
  firstName,
  onFinish,
}: {
  seed: VoiceTurn[]
  firstName: string | null
  onFinish: (turns: VoiceTurn[]) => void
}) {
  // A local greeting (no AI call) when there's no spoken conversation to continue.
  const [initialMessages] = useState(() =>
    turnsToMessages(
      seed.length > 0
        ? seed
        : [
            {
              role: 'jaden',
              text: `Hi${firstName ? ` ${firstName}` : ''}, I'm JADEN. How's your day going so far?`,
            },
          ],
    ),
  )
  const { messages, sendMessage, regenerate, clearError, status, error } = useChat({
    transport: typingTransport,
    messages: initialMessages,
  })
  const [text, setText] = useState('')
  const busy = status === 'submitted' || status === 'streaming'
  const turns = useMemo(() => messagesToTurns(messages), [messages])
  const rateLimited = chatRateLimitMessage(error)

  function send() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    clearError()
    void sendMessage({ text: trimmed })
    setText('')
  }

  return (
    <VoiceShell
      turns={turns}
      look={busy ? 'connecting' : 'typing'}
      status={busy ? 'JADEN is thinking…' : 'Typing with JADEN'}
    >
      {error && (
        <Alert>
          {rateLimited ?? "Something went wrong and JADEN couldn't answer."}
          {!rateLimited && (
            <button
              type="button"
              onClick={() => {
                clearError()
                void regenerate()
              }}
              className="ml-1 font-semibold text-cloud-700 hover:underline"
            >
              Try again
            </button>
          )}
        </Alert>
      )}
      <form
        className="flex w-full items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <label htmlFor="voice-typing-input" className="sr-only">
          Reply to JADEN
        </label>
        <textarea
          id="voice-typing-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={2}
          maxLength={TYPED_TURN_MAX_LENGTH}
          placeholder="Write your reply…"
          className="min-h-[52px] flex-1 resize-none rounded-[20px] border border-neutral-200 bg-surface px-4 py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || busy}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-surface transition-opacity disabled:opacity-60"
        >
          <ArrowRight className="size-[19px]" strokeWidth={2} />
        </button>
      </form>
      <Button
        variant="ink"
        size="cta-lg"
        className="w-full"
        disabled={busy || !hasUserWords(turns)}
        onClick={() => onFinish(turns)}
      >
        Finish and draft my entry
      </Button>
    </VoiceShell>
  )
}

/** Drafts an entry from the conversation; the entry is only created on "Review in editor". */
function DraftReview({ turns, onKeepTalking }: { turns: VoiceTurn[]; onKeepTalking: () => void }) {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()
  const draft = useMutation(trpc.v1.voice.draft.mutationOptions())
  const create = useMutation(trpc.v1.entry.create.mutationOptions())
  const { mutate: requestDraft } = draft

  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    requestDraft({ turns: fitTranscript(turns) })
  }, [requestDraft, turns])

  const save = () => {
    if (!draft.data) return
    create.mutate(
      {
        title: draft.data.title,
        body: draft.data.body,
        tags: [],
        timeZone: browserTimeZone(),
      },
      {
        onSuccess: (entry) => {
          void queryClient.invalidateQueries(trpc.v1.entry.findMany.pathFilter())
          router.push(`/journal/${entry.id}`)
        },
      },
    )
  }

  const look: Look = draft.data ? 'drafted' : draft.isError ? 'problem' : 'drafting'
  const status = draft.data
    ? 'Your draft is ready'
    : draft.isError
      ? "Couldn't draft your entry"
      : 'Drafting your entry'

  return (
    <VoiceShell turns={draft.data ? [] : turns} look={look} status={status}>
      {draft.data ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING}
            className="flex max-h-[40vh] w-full flex-col gap-2 overflow-y-auto rounded-2xl border border-cloud-200 bg-surface p-4 text-left"
          >
            {draft.data.title && (
              <p className="font-serif text-[19px] font-semibold text-neutral-900">
                {draft.data.title}
              </p>
            )}
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-neutral-600">
              {draft.data.body}
            </p>
          </motion.div>
          {create.isError && <Alert>{getApiErrorMessage(create.error)}</Alert>}
          <div className="flex w-full flex-col gap-2.5">
            <Button
              variant="ink"
              size="cta-lg"
              className="w-full"
              disabled={create.isPending || create.isSuccess}
              onClick={save}
            >
              {create.isPending || create.isSuccess ? 'Saving…' : 'Review in editor'}
            </Button>
            <Button
              asChild
              variant="link-cloud"
              className="self-center text-[13px] text-neutral-400"
            >
              <Link href="/journal">Discard</Link>
            </Button>
          </div>
        </>
      ) : draft.isError ? (
        <>
          <Alert>{getApiErrorMessage(draft.error)}</Alert>
          <div className="flex w-full flex-col gap-2.5">
            <Button
              variant="ink"
              size="cta-lg"
              className="w-full"
              onClick={() => requestDraft({ turns: fitTranscript(turns) })}
            >
              Try again
            </Button>
            <Button
              variant="link-cloud"
              className="self-center text-[13px]"
              onClick={onKeepTalking}
            >
              Keep talking by typing
            </Button>
          </div>
        </>
      ) : (
        <div className="flex h-[156px] items-center">
          <TypingIndicator label="Turning your conversation into an entry" />
        </div>
      )}
    </VoiceShell>
  )
}

/** Dark panel with the rolling transcript, over the bottom sheet with JADEN and the controls. */
function VoiceShell({
  turns,
  look,
  status,
  children,
}: {
  turns: VoiceTurn[]
  look: Look
  status: string
  children: ReactNode
}) {
  const jaden = JADEN_STATE[look]
  const visible = turns.slice(-3)
  const first = turns.length - visible.length

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

      <ol
        aria-live="polite"
        aria-label="Conversation"
        className="flex flex-1 flex-col justify-end gap-2.5 px-6 pt-16 pb-[128px]"
      >
        <AnimatePresence initial={false}>
          {visible.map((turn, i) => {
            const latest = i === visible.length - 1
            return (
              <motion.li
                key={first + i}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: latest ? 1 : 0.45, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING}
                className={cn(
                  'max-w-[85%] text-[15px] leading-relaxed',
                  turn.role === 'jaden'
                    ? 'self-start font-serif text-[17px] text-on-ink italic'
                    : 'self-end text-right text-[oklch(85%_0.02_260)]',
                )}
              >
                <span className="sr-only">{turn.role === 'jaden' ? 'JADEN: ' : 'You: '}</span>
                {turn.text}
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
          {status}
        </output>

        {children}

        <p className="text-center text-[11px] leading-snug text-neutral-400">
          Voice sessions are processed by cloud AI and logged in your{' '}
          <Link
            href="/settings/data-privacy"
            className="font-semibold text-cloud-700 hover:underline"
          >
            Processing Log
          </Link>
          . Audio is never stored or used to train models.
        </p>
      </div>
    </div>
  )
}

function VoiceMeter({ look, muted }: { look: Look; muted: boolean }) {
  const active = look === 'speaking' || look === 'listening'
  return (
    <>
      <div className="relative flex size-28 items-center justify-center">
        {look === 'listening' &&
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
            scale: look === 'speaking' ? [1, 1.08, 1] : 1,
            opacity: muted || look === 'connecting' ? 0.55 : 1,
          }}
          transition={look === 'speaking' ? { duration: 1.2, repeat: Infinity } : { duration: 0.3 }}
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
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="w-full rounded-[18px] border border-neutral-200 bg-surface px-[18px] py-3.5 text-[14px] leading-normal text-neutral-600"
    >
      {children}
    </div>
  )
}

function TypeInsteadLink({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="link-cloud" className="self-center text-[13px]" onClick={onClick}>
      <Keyboard className="size-4" />
      Prefer to type?
    </Button>
  )
}
