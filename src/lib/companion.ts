/**
 * Rules for when the writing companion may ask a question (issue #71).
 *
 * Shared by the browser, which uses them to decide when to ask, and the server, which enforces
 * them. The server is authoritative: the browser only avoids requests that would be refused.
 *
 * - Automatic questions need a typing pause of `COMPANION_PAUSE_MS` (browser only) and at least
 *   `COMPANION_MIN_NEW_WORDS` new words since the last question.
 * - "Another question" skips the word rule.
 * - Both are limited to one question per `COMPANION_COOLDOWN_MS` and `COMPANION_MAX_PER_ENTRY`
 *   per entry. The user's daily budget is enforced separately by `AiUsageService`.
 */

export const COMPANION_PAUSE_MS = 5000
export const COMPANION_MIN_NEW_WORDS = 40
export const COMPANION_COOLDOWN_MS = 60_000
export const COMPANION_MAX_PER_ENTRY = 5
/** Only the end of a long entry is sent to the model; that's where the user is writing. */
export const COMPANION_MAX_INPUT_CHARS = 6000

export type CompanionTrigger = 'auto' | 'manual'

export type CompanionBlockReason = 'cooldown' | 'entry_cap' | 'not_enough_text'

/** A question already asked (or being asked) for this entry. Failed attempts are left out. */
export type PriorCompanionQuestion = {
  createdAt: Date
  /** The entry's word count when the question was requested. */
  wordCount: number
}

export type CompanionDecision =
  { ok: true } | { ok: false; reason: CompanionBlockReason; retryAt?: Date }

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

export function evaluateCompanionRequest({
  now,
  trigger,
  wordCount,
  prior,
}: {
  now: Date
  trigger: CompanionTrigger
  wordCount: number
  prior: PriorCompanionQuestion[]
}): CompanionDecision {
  if (prior.length >= COMPANION_MAX_PER_ENTRY) return { ok: false, reason: 'entry_cap' }

  const last = prior.reduce<PriorCompanionQuestion | null>(
    (latest, question) =>
      latest === null || question.createdAt.getTime() > latest.createdAt.getTime()
        ? question
        : latest,
    null,
  )

  if (last) {
    const retryAt = new Date(last.createdAt.getTime() + COMPANION_COOLDOWN_MS)
    if (now.getTime() < retryAt.getTime()) return { ok: false, reason: 'cooldown', retryAt }
  }

  if (wordCount === 0) return { ok: false, reason: 'not_enough_text' }
  if (trigger === 'auto' && wordCount < (last?.wordCount ?? 0) + COMPANION_MIN_NEW_WORDS) {
    return { ok: false, reason: 'not_enough_text' }
  }

  return { ok: true }
}
