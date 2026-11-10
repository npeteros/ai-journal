export const CHAT_API = '/api/chat'

export const CHAT_RATE_LIMITED_CODE = 'RATE_LIMITED'
export const CHAT_RATE_LIMITED_MESSAGE =
  "You've reached your limit for JADEN for now. Take a breather and try again a little later."

export type ChatErrorBody = { error: string; code?: string }
