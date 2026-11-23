/**
 * Static prompts shown until a user has enough analyzed entries for an AI-generated one, and
 * while today's AI prompt is still being written. Picked by local day, so the server and the
 * browser agree on which one to show.
 */
export const DAILY_PROMPT_STARTERS = [
  'What is taking up the most space in your mind right now?',
  'What made today feel different from yesterday?',
  'What is one small thing you are looking forward to?',
  'When did you feel most like yourself this week?',
  'What is something you have been putting off, and why?',
  'Who has been on your mind lately, and what would you tell them?',
  'What drained your energy today, and what gave some back?',
  'What is a moment from today you would like to remember?',
  'What are you carrying that you could set down for a while?',
  'What did you learn about yourself recently?',
  'What would make tomorrow feel a little lighter?',
  'What are you grateful for that you usually overlook?',
  'What has been surprising you lately?',
  'If today had a title, what would it be?',
] as const

export const STARTER_PROMPT_SOURCE = 'A prompt to get you started'

/** The starter prompt for a "YYYY-MM-DD" day. */
export function starterPrompt(day: string): string {
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
  const index =
    ((dayNumber % DAILY_PROMPT_STARTERS.length) + DAILY_PROMPT_STARTERS.length) %
    DAILY_PROMPT_STARTERS.length
  return DAILY_PROMPT_STARTERS[Number.isNaN(index) ? 0 : index]!
}

/** The starter prompt for the day `now` falls on in `timeZone`. */
export const starterPromptAt = (timeZone: string, now = new Date()) =>
  starterPrompt(new Intl.DateTimeFormat('en-CA', { timeZone }).format(now))
