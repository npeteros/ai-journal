import {
  JADEN_INTERVIEW,
  JADEN_PERSONA,
  JADEN_SCOPE,
  JADEN_TONE,
} from '@/src/mastra/agents/jaden-persona'

/** Instructions for the spoken GPT-Live session. Fixed at session start; the browser can't change them. */
export const VOICE_SESSION_INSTRUCTIONS = `${JADEN_PERSONA}

${JADEN_SCOPE}

${JADEN_INTERVIEW}

You are speaking out loud. Use plain, natural spoken language: no lists, headings, emoji, or markdown. If you didn't catch something, ask the user to say it again.

${JADEN_TONE}`

/** Startup message telling Jaden how to open the conversation (sent as a developer message). */
export function buildVoiceGreeting(firstName: string | null): string {
  const name = firstName
    ? `by their first name, ${firstName}`
    : 'warmly (you do not know their name)'
  return `When the conversation starts, greet the user ${name}, say in a few words that you are Jaden, and ask one gentle question about how their day is going. Then pause and listen.`
}
