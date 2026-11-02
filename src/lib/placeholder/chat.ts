/**
 * PLACEHOLDER DATA — mock "chat with your journal" conversation for the UI build.
 * Replace with the chat agent (Mastra) stream + thread history.
 */
export type PlaceholderChatMessage = { id: string; role: 'user' | 'assistant'; text: string }

export const placeholderChat: PlaceholderChatMessage[] = [
  { id: 'm1', role: 'user', text: 'What themes keep coming up in my entries about work?' },
  {
    id: 'm2',
    role: 'assistant',
    text: "Over the last month, deadline pressure and feeling under-appreciated come up most — often on Mondays. You've also mentioned wanting clearer boundaries three times.",
  },
  { id: 'm3', role: 'user', text: 'That tracks. Any suggestion?' },
  {
    id: 'm4',
    role: 'assistant',
    text: 'Sunday evenings seem to set the tone — worth trying a short wind-down ritual before the week starts?',
  },
]

export const chatTypingLabel = 'reading 3 Sunday entries'
