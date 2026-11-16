import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTurn } from '@/src/lib/voice'
import type { LiveVoiceError, LiveVoicePhase } from './use-live-voice-session'

type VoiceState = {
  phase: LiveVoicePhase
  error: LiveVoiceError | null
  turns: VoiceTurn[]
  muted: boolean
  remainingSeconds: number
  jadenSpeaking: boolean
  userSpeaking: boolean
}

const mocks = vi.hoisted(() => ({
  voice: {} as Record<string, unknown>,
  start: vi.fn(),
  end: vi.fn(),
  toggleMute: vi.fn(),
  draft: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
  chatMessages: [] as unknown[],
  sendMessage: vi.fn(),
}))

vi.mock('./use-live-voice-session', () => ({
  useLiveVoiceSession: () => ({
    ...mocks.voice,
    start: mocks.start,
    end: mocks.end,
    toggleMute: mocks.toggleMute,
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@ai-sdk/react', () => ({
  useChat: ({ messages }: { messages: unknown[] }) => {
    mocks.chatMessages = messages
    return {
      messages,
      sendMessage: mocks.sendMessage,
      regenerate: vi.fn(),
      clearError: vi.fn(),
      status: 'ready',
      error: undefined,
    }
  },
}))
vi.mock('@/components/jaden', () => ({
  Jaden: () => null,
  JadenPerch: ({ children }: { children: ReactNode }) => children,
  PLACEMENTS: { voice: { size: 80 } },
}))
vi.mock('@/src/server/trpc/client', () => ({
  useTRPC: () => ({
    v1: {
      voice: {
        draft: { mutationOptions: () => ({ mutationKey: ['draft'], mutationFn: mocks.draft }) },
      },
      entry: {
        create: { mutationOptions: () => ({ mutationKey: ['create'], mutationFn: mocks.create }) },
        findMany: { pathFilter: () => ({ queryKey: ['entries'] }) },
      },
    },
  }),
}))

const { VoiceSession } = await import('./voice-session')

const conversation: VoiceTurn[] = [
  { role: 'jaden', text: "Hey Maya, I'm Jaden. How's your day going so far?" },
  { role: 'user', text: 'Slow morning, I sat with my coffee.' },
]

function setVoice(state: Partial<VoiceState>) {
  mocks.voice = {
    phase: 'idle',
    error: null,
    turns: [],
    muted: false,
    remainingSeconds: 600,
    jadenSpeaking: false,
    userSpeaking: false,
    ...state,
  }
}

function renderSession() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <VoiceSession firstName="Maya" />
    </QueryClientProvider>,
  )
}

describe('VoiceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setVoice({})
    mocks.draft.mockResolvedValue({ title: 'A slower morning', body: 'I sat with my coffee.' })
    mocks.create.mockResolvedValue({ id: 'entry-1' })
  })

  it('explains the session and starts it on request', () => {
    renderSession()

    expect(screen.getByText(/audio is never recorded or stored/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /start talking/i }))
    expect(mocks.start).toHaveBeenCalledOnce()
  })

  it('shows the countdown and ends a live session', () => {
    setVoice({ phase: 'live', turns: conversation, remainingSeconds: 542 })
    renderSession()

    expect(screen.getByText(/listening… · 9:02 left/i)).toBeTruthy()
    expect(screen.getByText('Slow morning, I sat with my coffee.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /end session/i }))
    expect(mocks.end).toHaveBeenCalledOnce()
  })

  it('explains a blocked microphone and continues the conversation by typing', () => {
    setVoice({ phase: 'failed', error: 'mic-denied' })
    renderSession()

    expect(screen.getByRole('alert').textContent).toMatch(/microphone access is blocked/i)
    expect(screen.queryByRole('button', { name: /try voice again/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /continue by typing/i }))

    expect(screen.getByLabelText(/reply to jaden/i)).toBeTruthy()
    // With nothing spoken yet, typing starts from a local greeting (no AI call).
    expect(mocks.chatMessages).toEqual([
      {
        id: 'seed-0',
        role: 'assistant',
        parts: [{ type: 'text', text: "Hi Maya, I'm JADEN. How's your day going so far?" }],
      },
    ])
  })

  it('carries the spoken turns into typing when the connection drops', () => {
    setVoice({ phase: 'failed', error: 'connection-lost', turns: conversation })
    renderSession()

    fireEvent.click(screen.getByRole('button', { name: /continue by typing/i }))

    expect(mocks.chatMessages).toHaveLength(2)
    expect(mocks.chatMessages[1]).toMatchObject({ role: 'user' })
  })

  it('shows the voice budget message without offering voice again', () => {
    setVoice({ phase: 'failed', error: 'limit' })
    renderSession()

    expect(screen.getByRole('alert').textContent).toMatch(/today's voice sessions/i)
    expect(screen.queryByRole('button', { name: /try voice again/i })).toBeNull()
  })

  it('drafts the ended conversation and saves it only on Review in editor', async () => {
    setVoice({ phase: 'ended', turns: conversation })
    renderSession()

    await screen.findByText('A slower morning')
    expect(mocks.draft.mock.calls[0][0]).toEqual({ turns: conversation })
    expect(mocks.create).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /review in editor/i }))

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/journal/entry-1'))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      title: 'A slower morning',
      body: 'I sat with my coffee.',
      tags: [],
    })
  })

  it('discards the draft without creating an entry', async () => {
    setVoice({ phase: 'ended', turns: conversation })
    renderSession()

    await screen.findByText('A slower morning')
    expect(screen.getByRole('link', { name: /discard/i }).getAttribute('href')).toBe('/journal')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('offers to retry when drafting fails', async () => {
    mocks.draft.mockRejectedValueOnce({ data: { code: 'TOO_MANY_REQUESTS' } })
    setVoice({ phase: 'ended', turns: conversation })
    renderSession()

    expect((await screen.findByRole('alert')).textContent).toMatch(/reached your limit/i)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await screen.findByText('A slower morning')
    expect(mocks.draft).toHaveBeenCalledTimes(2)
  })

  it('does not draft a session where the user said nothing', () => {
    setVoice({ phase: 'ended', turns: [conversation[0]] })
    renderSession()

    expect(screen.getByRole('alert').textContent).toMatch(/didn't catch anything/i)
    expect(mocks.draft).not.toHaveBeenCalled()
  })
})
