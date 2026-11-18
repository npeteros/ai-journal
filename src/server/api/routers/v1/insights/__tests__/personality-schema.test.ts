import { describe, expect, it } from 'vitest'
import {
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
})
