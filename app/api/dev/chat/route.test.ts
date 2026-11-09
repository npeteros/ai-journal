// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  handleChatStream: vi.fn(),
  peekRateLimit: vi.fn(),
  getMemory: vi.fn(),
  recall: vi.fn(),
}))

vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@mastra/ai-sdk', () => ({ handleChatStream: mocks.handleChatStream }))
vi.mock('@mastra/ai-sdk/ui', () => ({ toAISdkMessages: vi.fn().mockReturnValue([]) }))
vi.mock('ai', () => ({
  createUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('chat')),
}))
vi.mock('@/src/mastra/guardrails/chatStream', () => ({ peekRateLimit: mocks.peekRateLimit }))
vi.mock('@/src/mastra', () => ({
  mastra: {
    getAgentById: vi.fn(() => ({ getMemory: mocks.getMemory })),
  },
}))

const { GET, POST } = await import('./route')

describe('dev journal chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.handleChatStream.mockResolvedValue('stream')
    mocks.peekRateLimit.mockResolvedValue({ limited: false, stream: 'stream' })
    mocks.getMemory.mockResolvedValue({ recall: mocks.recall })
  })

  it('requires Better Auth before starting a chat', async () => {
    mocks.getSession.mockResolvedValue(null)

    await expect(
      POST(new Request('http://localhost/api/dev/chat', { method: 'POST' })),
    ).resolves.toMatchObject({
      status: 401,
    })
  })

  it('uses Jaden with a trusted context, user-scoped memory, abort signal, and rate-limit handling', async () => {
    const createRequest = () =>
      new Request('http://localhost/api/dev/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [], trigger: 'submit' }),
      })
    const request = createRequest()

    await expect(POST(request)).resolves.toMatchObject({ status: 200 })
    const args = mocks.handleChatStream.mock.calls[0][0]
    expect(args.agentId).toBe('journal-companion-agent')
    expect(args.params.requestContext.get('userId')).toBe('user-1')
    expect(args.params.memory).toEqual({ thread: 'dev-chat-user-1', resource: 'user-1' })
    expect(args.params.abortSignal).toBe(request.signal)

    mocks.peekRateLimit.mockResolvedValue({ limited: true, reason: 'AI rate limit exceeded' })
    await expect(POST(createRequest())).resolves.toMatchObject({ status: 429 })
  })

  it("recalls only the authenticated user's memory thread", async () => {
    await expect(GET(new Request('http://localhost/api/dev/chat'))).resolves.toMatchObject({
      status: 200,
    })
    expect(mocks.recall).toHaveBeenCalledWith({ threadId: 'dev-chat-user-1', resourceId: 'user-1' })
  })
})
