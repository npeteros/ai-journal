import { Agent } from '@mastra/core/agent'
import { aiUsageProcessor } from '../guardrails/AiUsageProcessor'
import { JADEN_INTERVIEW, JADEN_PERSONA, JADEN_SCOPE, JADEN_TONE } from './jaden-persona'
import { withUserProfile } from './user-profile-prompt'

export const VOICE_COMPANION_AGENT_ID = 'voice-companion-agent'

/**
 * Typed version of the spoken journaling session, used when voice isn't available (microphone
 * denied, connection lost, voice budget used up). Same interview rules as the GPT-Live session.
 */
export const VOICE_COMPANION_INSTRUCTIONS = `${JADEN_PERSONA}

${JADEN_SCOPE}

${JADEN_INTERVIEW}

The conversation may have started out loud and continued in text, so earlier user turns can read like transcribed speech. Reply in plain text without lists or headings.

${JADEN_TONE}`

export const voiceCompanionAgent = new Agent({
  id: VOICE_COMPANION_AGENT_ID,
  name: 'Jaden (voice journaling)',
  instructions: withUserProfile(VOICE_COMPANION_INSTRUCTIONS, 'conversation'),
  model: 'openai/gpt-5-mini',
  inputProcessors: [aiUsageProcessor],
  outputProcessors: [aiUsageProcessor],
})
