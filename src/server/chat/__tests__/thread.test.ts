// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemory: vi.fn(),
  getThreadById: vi.fn(),
  recall: vi.fn(),
}))

vi.mock('@/src/mastra', () => ({
  mastra: { getAgentById: vi.fn(() => ({ getMemory: mocks.getMemory })) },
}))
vi.mock('@/src/mastra/agents/journal-companion-agent', () => ({
  JOURNAL_COMPANION_AGENT_ID: 'journal-companion-agent',
}))
vi.mock('@mastra/ai-sdk/ui', () => ({
  toAISdkMessages: vi.fn((messages: unknown[]) => messages.map((m) => ({ converted: m }))),
}))

const { chatThreadId, loadChatHistory } = await import('../thread')

describe('loadChatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemory.mockResolvedValue({ getThreadById: mocks.getThreadById, recall: mocks.recall })
    mocks.getThreadById.mockResolvedValue({ id: 'journal-chat-user-1', resourceId: 'user-1' })
    mocks.recall.mockResolvedValue({ messages: ['a', 'b'] })
  })

  it("recalls the user's own thread", async () => {
    await expect(loadChatHistory('user-1')).resolves.toEqual([
      { converted: 'a' },
      { converted: 'b' },
    ])
    expect(mocks.getThreadById).toHaveBeenCalledWith({ threadId: chatThreadId('user-1') })
    expect(mocks.recall).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'journal-chat-user-1', resourceId: 'user-1' }),
    )
  })

  it('returns an empty history when the thread does not exist yet', async () => {
    mocks.getThreadById.mockResolvedValue(null)

    await expect(loadChatHistory('user-1')).resolves.toEqual([])
    expect(mocks.recall).not.toHaveBeenCalled()
  })

  it('never returns a thread owned by another user', async () => {
    mocks.getThreadById.mockResolvedValue({ id: 'journal-chat-user-1', resourceId: 'user-2' })

    await expect(loadChatHistory('user-1')).resolves.toEqual([])
    expect(mocks.recall).not.toHaveBeenCalled()
  })
})
