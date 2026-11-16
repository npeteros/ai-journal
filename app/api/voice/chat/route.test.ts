// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  handleChatStream: vi.fn(),
  peekRateLimit: vi.fn(),
}))

vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@mastra/ai-sdk', () => ({ handleChatStream: mocks.handleChatStream }))
vi.mock('@/src/mastra/guardrails/chatStream', () => ({ peekRateLimit: mocks.peekRateLimit }))
vi.mock('@/src/mastra/agents/voice-companion-agent', () => ({
  VOICE_COMPANION_AGENT_ID: 'voice-companion-agent',
}))
vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  createUIMessageStreamResponse: vi.fn(() => new Response('chat')),
}))

const { POST } = await import('./route')
const { VOICE_CHAT_CONTEXT_MESSAGES } = await import('@/src/lib/voice')

const userMessage = {
  id: 'm1',
  role: 'user',
  parts: [{ type: 'text', text: 'Slow morning, sat with my coffee.' }],
}
const jadenMessage = {
  id: 'm0',
  role: 'assistant',
  parts: [{ type: 'text', text: "Hi Maya, I'm Jaden. How's your day going?" }],
}

const request = (body: unknown) =>
  new Request('http://localhost/api/voice/chat', { method: 'POST', body: JSON.stringify(body) })

describe('voice chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.handleChatStream.mockResolvedValue('stream')
    mocks.peekRateLimit.mockResolvedValue({ limited: false, stream: 'stream' })
  })

  it('requires a session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const res = await POST(request({ messages: [userMessage] }))

    expect(res.status).toBe(401)
    expect(mocks.handleChatStream).not.toHaveBeenCalled()
  })

  it('streams the conversation from the voice companion for the signed-in user', async () => {
    const req = request({ messages: [jadenMessage, userMessage], instructions: 'forged' })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.agentId).toBe('voice-companion-agent')
    expect(args.params.messages).toEqual([jadenMessage, userMessage])
    expect(args.params.requestContext.get('userId')).toBe('user-1')
    expect(args.params.abortSignal).toBe(req.signal)
    expect(args.params).not.toHaveProperty('instructions')
  })

  it('keeps only the most recent messages', async () => {
    const history = Array.from({ length: VOICE_CHAT_CONTEXT_MESSAGES + 5 }, (_, i) => ({
      ...userMessage,
      id: `m${i}`,
    }))

    await POST(request({ messages: history }))

    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.params.messages).toEqual(history.slice(-VOICE_CHAT_CONTEXT_MESSAGES))
  })

  it.each([
    ['no messages', {}],
    ['a trailing assistant message', { messages: [userMessage, jadenMessage] }],
    ['a system message', { messages: [{ ...userMessage, role: 'system' }, userMessage] }],
  ])('rejects %s with 400', async (_, body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(mocks.handleChatStream).not.toHaveBeenCalled()
  })

  it('returns 429 when over the shared AI limit', async () => {
    mocks.peekRateLimit.mockResolvedValue({ limited: true, reason: 'AI rate limit exceeded' })

    const res = await POST(request({ messages: [userMessage] }))

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' })
  })
})
