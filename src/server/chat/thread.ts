import { toAISdkMessages } from '@mastra/ai-sdk/ui'
import type { UIMessage } from 'ai'

import { mastra } from '@/src/mastra'
import { JOURNAL_COMPANION_AGENT_ID } from '@/src/mastra/agents/journal-companion-agent'

export const CHAT_AGENT_ID = JOURNAL_COMPANION_AGENT_ID

export const CHAT_HISTORY_LIMIT = 100

export function chatThreadId(userId: string): string {
  return `journal-chat-${userId}`
}

export async function loadChatHistory(userId: string): Promise<UIMessage[]> {
  const memory = await mastra.getAgentById(CHAT_AGENT_ID).getMemory()
  if (!memory) return []

  const threadId = chatThreadId(userId)
  const thread = await memory.getThreadById({ threadId })
  if (!thread || thread.resourceId !== userId) return []

  const { messages } = await memory.recall({
    threadId,
    resourceId: userId,
    perPage: CHAT_HISTORY_LIMIT,
  })
  return toAISdkMessages(messages, { version: 'v7' })
}
