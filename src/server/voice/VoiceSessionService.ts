import 'server-only'
import { createHash } from 'node:crypto'
import type { IMastraLogger } from '@mastra/core/logger'
import { aiUsageService, type AiUsageService } from '@/src/mastra/guardrails/AiUsageService'
import { logger } from '@/src/mastra/observability'
import { firstNameOf } from '@/src/lib/format'
import { VOICE_MAX_SECONDS, type VoiceSessionResponse } from '@/src/lib/voice'
import { createLiveSession, type CreateLiveSessionInput, type LiveSession } from './gpt-live'
import { buildVoiceGreeting, VOICE_SESSION_INSTRUCTIONS } from './instructions'

export type StartVoiceSessionInput = {
  userId: string
  userName: string
  sdp: string
}

type VoiceUsage = Pick<AiUsageService, 'reserveVoiceSession' | 'finalizeVoiceSession'>

/** Stable, non-reversible per-user ID for OpenAI abuse monitoring; never the raw ID or email. */
export function voiceSafetyIdentifier(userId: string): string {
  return createHash('sha256').update(`jaden-voice:${userId}`).digest('hex')
}

/**
 * Starts a spoken journaling session: checks the user's voice budget, reserves its usage row,
 * then creates the GPT-Live session with Jaden's fixed instructions. Throws TRPCError
 * TOO_MANY_REQUESTS when the budget is used up, and LiveSessionError when OpenAI fails (the
 * reserved row is then recorded as a failed session).
 */
export class VoiceSessionService {
  constructor(
    private readonly usage: VoiceUsage = aiUsageService,
    private readonly createSession: (input: CreateLiveSessionInput) => Promise<LiveSession> = (
      input,
    ) => createLiveSession(input),
    private readonly log: IMastraLogger = logger,
  ) {}

  async start({ userId, userName, sdp }: StartVoiceSessionInput): Promise<VoiceSessionResponse> {
    const usageId = await this.usage.reserveVoiceSession(userId)

    try {
      const session = await this.createSession({
        sdp,
        instructions: VOICE_SESSION_INSTRUCTIONS,
        greeting: buildVoiceGreeting(firstNameOf(userName)),
        safetyIdentifier: voiceSafetyIdentifier(userId),
      })
      this.log.info('Voice session started', { userId, usageId, sessionId: session.sessionId })
      return { sdp: session.sdp, usageId, maxSeconds: VOICE_MAX_SECONDS }
    } catch (error) {
      this.log.error('Voice session creation failed', { userId, usageId, error })
      await this.usage.finalizeVoiceSession({ usageId, userId, seconds: 0, success: false })
      throw error
    }
  }
}

export const voiceSessionService = new VoiceSessionService()
