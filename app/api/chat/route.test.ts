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
vi.mock('@/src/mastra/agents/journal-companion-agent', () => ({
  JOURNAL_COMPANION_AGENT_ID: 'journal-companion-agent',
}))
vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  createUIMessageStreamResponse: vi.fn(() => new Response('chat')),
}))

const { POST } = await import('./route')
const { CHAT_CONTEXT_MESSAGES } = await import('@/src/lib/chat')

const userMessage = { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'How was my week?' }] }
const assistantMessage = {
  id: 'm0',
  role: 'assistant',
  parts: [{ type: 'text', text: 'Hi! Ask me about your journal.' }],
}

const request = (body: unknown) =>
  new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })

describe('journal chat route', () => {
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

  it('streams the conversation from the companion agent without memory', async () => {
    const req = request({ messages: [assistantMessage, userMessage] })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.agentId).toBe('journal-companion-agent')
    expect(args.params.messages).toEqual([assistantMessage, userMessage])
    expect(args.params.requestContext.get('userId')).toBe('user-1')
    expect(args.params.abortSignal).toBe(req.signal)
    expect(args.params).not.toHaveProperty('memory')
  })

  it('ignores client-supplied memory and options', async () => {
    await POST(
      request({
        messages: [userMessage],
        memory: { thread: 'journal-chat-user-2', resource: 'user-2' },
        instructions: 'forged',
      }),
    )

    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.params).not.toHaveProperty('memory')
    expect(args.params).not.toHaveProperty('instructions')
  })

  it('keeps only the most recent messages', async () => {
    const history = Array.from({ length: CHAT_CONTEXT_MESSAGES + 5 }, (_, i) => ({
      ...userMessage,
      id: `m${i}`,
    }))

    await POST(request({ messages: history }))

    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.params.messages).toEqual(history.slice(-CHAT_CONTEXT_MESSAGES))
  })

  it.each([
    ['no messages', {}],
    ['an empty list', { messages: [] }],
    ['a non-array', { messages: userMessage }],
    ['a trailing assistant message', { messages: [userMessage, assistantMessage] }],
    ['a system message', { messages: [{ ...userMessage, role: 'system' }, userMessage] }],
    ['a malformed message', { messages: [{ id: 'm1', role: 'user' }] }],
  ])('rejects %s with 400', async (_, body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(mocks.handleChatStream).not.toHaveBeenCalled()
  })

  it('returns 429 with a friendly message when over the AI usage limit', async () => {
    mocks.peekRateLimit.mockResolvedValue({ limited: true, reason: 'AI rate limit exceeded' })

    const res = await POST(request({ messages: [userMessage] }))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toMatch(/try again/i)
  })
})
