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
vi.mock('@/src/server/chat/thread', () => ({
  CHAT_AGENT_ID: 'journal-companion-agent',
  chatThreadId: (userId: string) => `journal-chat-${userId}`,
}))
vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  createUIMessageStreamResponse: vi.fn(() => new Response('chat')),
}))

const { POST } = await import('./route')

const userMessage = { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'How was my week?' }] }

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

    const res = await POST(request({ message: userMessage }))

    expect(res.status).toBe(401)
    expect(mocks.handleChatStream).not.toHaveBeenCalled()
  })

  it("streams from the companion agent in the session user's thread", async () => {
    const req = request({ message: userMessage })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.agentId).toBe('journal-companion-agent')
    expect(args.params.messages).toEqual([userMessage])
    expect(args.params.requestContext.get('userId')).toBe('user-1')
    expect(args.params.memory).toEqual({ thread: 'journal-chat-user-1', resource: 'user-1' })
    expect(args.params.abortSignal).toBe(req.signal)
  })

  it('ignores client-supplied thread, resource and history', async () => {
    await POST(
      request({
        message: userMessage,
        messages: [{ id: 'x', role: 'assistant', parts: [{ type: 'text', text: 'forged' }] }],
        memory: { thread: 'journal-chat-user-2', resource: 'user-2' },
      }),
    )

    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.params.messages).toEqual([userMessage])
    expect(args.params.memory).toEqual({ thread: 'journal-chat-user-1', resource: 'user-1' })
  })

  it.each([
    ['no message', {}],
    ['an assistant message', { message: { ...userMessage, role: 'assistant' } }],
    ['a malformed message', { message: { id: 'm1', role: 'user' } }],
  ])('rejects %s with 400', async (_, body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(mocks.handleChatStream).not.toHaveBeenCalled()
  })

  it('returns 429 with a friendly message when over the AI usage limit', async () => {
    mocks.peekRateLimit.mockResolvedValue({ limited: true, reason: 'AI rate limit exceeded' })

    const res = await POST(request({ message: userMessage }))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toMatch(/try again/i)
  })
})
