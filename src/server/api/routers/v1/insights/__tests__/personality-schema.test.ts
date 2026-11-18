import { describe, expect, it } from 'vitest'
import {
  stripDisclaimers,
  stripEntryCitations,
  validatePersonalityProfile,
  BIG_FIVE_TRAITS,
  filterOwnedPersonalityProfile,
  personalityLevel,
  toPersonalityTraitDisplay,
} from '../personality-schema'

const ENTRY_IDS = BIG_FIVE_TRAITS.map(
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
)

function validProfile() {
  return {
    traits: BIG_FIVE_TRAITS.map((trait, index) => ({
      trait,
      score: [0, 33, 34, 66, 100][index],
      level: 'High',
      evidenceEntryIds: [ENTRY_IDS[index]],
    })),
    summary: 'Your entries suggest several recurring patterns in how you reflect.',
    meaning: 'This is a careful reflection of the patterns present in your writing over time.',
  }
}

describe('personality profile schema', () => {
  it.each([
    [0, 'Low'],
    [33, 'Low'],
    [34, 'Moderate'],
    [66, 'Moderate'],
    [67, 'High'],
    [100, 'High'],
  ] as const)('derives %s as %s', (score, level) => {
    expect(personalityLevel(score)).toBe(level)
  })

  it('normalizes finite scores and derives levels instead of trusting model levels', () => {
    const profile = validProfile()
    profile.traits[0].score = -5
    profile.traits[1].score = 33.6
    profile.traits[2].score = 140

    const result = filterOwnedPersonalityProfile(profile, new Set(ENTRY_IDS))

    expect(result?.traits.slice(0, 3)).toEqual([
      expect.objectContaining({ score: 0, level: 'Low' }),
      expect.objectContaining({ score: 34, level: 'Moderate' }),
      expect.objectContaining({ score: 100, level: 'High' }),
    ])
  })

  it('rejects non-finite scores, missing traits, and duplicated traits', () => {
    const invalidScore = validProfile()
    invalidScore.traits[0].score = Number.POSITIVE_INFINITY
    expect(filterOwnedPersonalityProfile(invalidScore, new Set(ENTRY_IDS))).toBeNull()

    const missing = validProfile()
    missing.traits.pop()
    expect(filterOwnedPersonalityProfile(missing, new Set(ENTRY_IDS))).toBeNull()

    const duplicate = validProfile()
    duplicate.traits[4].trait = 'openness'
    expect(filterOwnedPersonalityProfile(duplicate, new Set(ENTRY_IDS))).toBeNull()
  })

  it('deduplicates owned evidence and rejects a trait with no authorized evidence', () => {
    const profile = validProfile()
    profile.traits[0].evidenceEntryIds = [ENTRY_IDS[0], ENTRY_IDS[0], ENTRY_IDS[1]]
    profile.traits[1].evidenceEntryIds = ['00000000-0000-4000-8000-999999999999', ENTRY_IDS[1]]

    const result = filterOwnedPersonalityProfile(profile, new Set(ENTRY_IDS))
    expect(result?.traits[0].evidenceEntryIds).toEqual([ENTRY_IDS[0], ENTRY_IDS[1]])
    expect(result?.traits[1].evidenceEntryIds).toEqual([ENTRY_IDS[1]])

    profile.traits[2].evidenceEntryIds = ['00000000-0000-4000-8000-999999999999']
    expect(filterOwnedPersonalityProfile(profile, new Set(ENTRY_IDS))).toBeNull()
  })

  it('maps canonical neuroticism to inverse Emotional stability for display', () => {
    const profile = filterOwnedPersonalityProfile(validProfile(), new Set(ENTRY_IDS))
    if (!profile) throw new Error('Expected valid profile fixture')

    const display = toPersonalityTraitDisplay({
      trait: 'neuroticism',
      score: 80,
      level: 'High',
      evidenceEntryIds: [ENTRY_IDS[4]],
    })

    expect(display).toEqual({
      trait: 'neuroticism',
      label: 'Emotional stability',
      score: 20,
      level: 'Low',
    })
  })

  it('strips entry-ID citations the model writes into prose', () => {
    expect(
      stripEntryCitations(
        'Your entries suggest you savor creative moments (361eeba9, 649bd0f4, d9ce9ec2), and ' +
          'show care when plans slip (f21707fc).',
      ),
    ).toBe('Your entries suggest you savor creative moments, and show care when plans slip.')
    expect(
      stripEntryCitations(
        'Some worry appears (entry 1184b71e and 00000000-0000-4000-8000-000000000001).',
      ),
    ).toBe('Some worry appears.')
    expect(stripEntryCitations('See 00000000-0000-4000-8000-000000000001 for context.')).toBe(
      'See for context.',
    )
  })

  it('keeps ordinary parentheticals', () => {
    const text = 'You plan ahead (often in the mornings) and revisit ideas (defaced, effaced).'
    expect(stripEntryCitations(text)).toBe(text)
  })

  it('rejects output scored on a 0-1 scale instead of rounding it to near-zero bars', () => {
    const ids = BIG_FIVE_TRAITS.map(
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    )
    const output = (scores: number[]) => ({
      traits: BIG_FIVE_TRAITS.map((trait, index) => ({
        trait,
        score: scores[index],
        evidenceEntryIds: [ids[index]],
      })),
      summary: 'Your entries suggest steady patterns.',
      meaning: 'A tentative reflection on your writing.',
    })

    expect(
      filterOwnedPersonalityProfile(output([0.6, 0.7, 0.3, 0.8, 0.4]), new Set(ids)),
    ).toBeNull()
    expect(filterOwnedPersonalityProfile(output([1, 1, 0, 1, 1]), new Set(ids))).toBeNull()
    expect(filterOwnedPersonalityProfile(output([60, 1, 30, 80, 40]), new Set(ids))).not.toBeNull()
  })

  it('reports which check rejected a profile, without the rejected values', () => {
    const ids = BIG_FIVE_TRAITS.map(
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    )
    const output = (overrides: { evidence?: string[][]; summary?: string } = {}) => ({
      traits: BIG_FIVE_TRAITS.map((trait, index) => ({
        trait,
        score: 50,
        evidenceEntryIds: overrides.evidence?.[index] ?? [ids[index]],
      })),
      summary: overrides.summary ?? 'Your entries suggest steady patterns.',
      meaning: 'A tentative reflection on your writing.',
    })
    const allowed = new Set(ids)

    const prefixed = validatePersonalityProfile(output({ evidence: [['361eeba9']] }), allowed)
    expect(prefixed.reason).toBe('output schema: traits.0.evidenceEntryIds.0 invalid_format')
    expect(prefixed.reason).not.toContain('361eeba9')

    const unknown = validatePersonalityProfile(
      output({ evidence: [['00000000-0000-4000-8000-999999999999']] }),
      allowed,
    )
    expect(unknown.reason).toBe('openness cites none of the supplied entries (1 unknown IDs)')

    const long = validatePersonalityProfile(output({ summary: 'x'.repeat(300) }), allowed)
    expect(long.reason).toBe('output schema: summary too_big')

    expect(validatePersonalityProfile(output(), allowed)).toMatchObject({ reason: null })
  })

  it('drops disclaimer sentences but keeps positive clinical claims for the safety check', () => {
    expect(
      stripDisclaimers(
        'Your entries suggest curiosity. These are not clinical observations. They may change.',
      ),
    ).toBe('Your entries suggest curiosity. They may change.')
    expect(
      stripDisclaimers("This isn't a diagnosis or an assessment; it reflects your writing."),
    ).toBe('')
    expect(stripDisclaimers('Your entries show clinical depression.')).toBe(
      'Your entries show clinical depression.',
    )
    expect(stripDisclaimers('No two weeks look the same in your writing.')).toBe(
      'No two weeks look the same in your writing.',
    )
  })

  it('keeps a profile whose only blocked word was in a disclaimer', () => {
    const ids = BIG_FIVE_TRAITS.map(
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    )
    const profile = filterOwnedPersonalityProfile(
      {
        traits: BIG_FIVE_TRAITS.map((trait, index) => ({
          trait,
          score: 50,
          evidenceEntryIds: [ids[index]],
        })),
        summary: 'Your entries suggest steady patterns.',
        meaning: 'You plan carefully. These are tentative, not clinical, observations.',
      },
      new Set(ids),
    )
    expect(profile?.meaning).toBe('You plan carefully.')
  })
})
