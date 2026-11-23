// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  COMPANION_COOLDOWN_MS,
  COMPANION_MAX_PER_ENTRY,
  COMPANION_MIN_NEW_WORDS,
  countWords,
  evaluateCompanionRequest,
  type PriorCompanionQuestion,
} from '../companion'

const now = new Date('2026-11-23T10:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const asked = (msAgo: number, wordCount: number): PriorCompanionQuestion => ({
  createdAt: ago(msAgo),
  wordCount,
})

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n\t ')).toBe(0)
    expect(countWords('one')).toBe(1)
    expect(countWords('  one two\n\nthree\tfour  ')).toBe(4)
  })
})

describe('evaluateCompanionRequest', () => {
  it('asks automatically once enough words are written', () => {
    expect(
      evaluateCompanionRequest({
        now,
        trigger: 'auto',
        wordCount: COMPANION_MIN_NEW_WORDS,
        prior: [],
      }),
    ).toEqual({ ok: true })
    expect(
      evaluateCompanionRequest({
        now,
        trigger: 'auto',
        wordCount: COMPANION_MIN_NEW_WORDS - 1,
        prior: [],
      }),
    ).toEqual({ ok: false, reason: 'not_enough_text' })
  })

  it('counts new words since the last question for automatic questions', () => {
    const prior = [asked(COMPANION_COOLDOWN_MS * 2, 100)]

    expect(evaluateCompanionRequest({ now, trigger: 'auto', wordCount: 139, prior })).toEqual({
      ok: false,
      reason: 'not_enough_text',
    })
    expect(evaluateCompanionRequest({ now, trigger: 'auto', wordCount: 140, prior })).toEqual({
      ok: true,
    })
  })

  it('lets a manual request skip the word rule, but not an empty entry', () => {
    const prior = [asked(COMPANION_COOLDOWN_MS * 2, 100)]

    expect(evaluateCompanionRequest({ now, trigger: 'manual', wordCount: 101, prior })).toEqual({
      ok: true,
    })
    expect(evaluateCompanionRequest({ now, trigger: 'manual', wordCount: 0, prior: [] })).toEqual({
      ok: false,
      reason: 'not_enough_text',
    })
  })

  it('allows one question per cooldown and reports when the next one is allowed', () => {
    const prior = [asked(COMPANION_COOLDOWN_MS - 1000, 10)]

    for (const trigger of ['auto', 'manual'] as const) {
      expect(evaluateCompanionRequest({ now, trigger, wordCount: 500, prior })).toEqual({
        ok: false,
        reason: 'cooldown',
        retryAt: new Date(now.getTime() + 1000),
      })
    }
    expect(
      evaluateCompanionRequest({
        now,
        trigger: 'manual',
        wordCount: 500,
        prior: [asked(COMPANION_COOLDOWN_MS, 10)],
      }),
    ).toEqual({ ok: true })
  })

  it('measures the cooldown and new words from the latest question, in any order', () => {
    const prior = [asked(10 * 60_000, 300), asked(20 * 60_000, 10)]

    expect(evaluateCompanionRequest({ now, trigger: 'auto', wordCount: 60, prior })).toEqual({
      ok: false,
      reason: 'not_enough_text',
    })
    expect(evaluateCompanionRequest({ now, trigger: 'auto', wordCount: 340, prior })).toEqual({
      ok: true,
    })
  })

  it('stops at the per-entry cap, whatever the trigger', () => {
    const prior = Array.from({ length: COMPANION_MAX_PER_ENTRY }, (_, i) =>
      asked((i + 2) * COMPANION_COOLDOWN_MS, i * 50),
    )

    for (const trigger of ['auto', 'manual'] as const) {
      expect(evaluateCompanionRequest({ now, trigger, wordCount: 10_000, prior })).toEqual({
        ok: false,
        reason: 'entry_cap',
      })
    }
    expect(
      evaluateCompanionRequest({
        now,
        trigger: 'manual',
        wordCount: 10_000,
        prior: prior.slice(1),
      }),
    ).toEqual({ ok: true })
  })
})
