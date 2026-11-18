// @vitest-environment node
import type { IMastraLogger } from '@mastra/core/logger'
import { MastraTimeoutError } from '@mastra/core/loop'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))

import { BIG_FIVE_TRAITS } from '../../personality-schema'
import {
  PersonalityProfileService,
  PERSONALITY_PROFILE_FAILURE_COOLDOWN_MS,
  PERSONALITY_PROFILE_LOCK_TIMEOUT_MS,
  PERSONALITY_PROFILE_MAX_AGE_MS,
  PERSONALITY_PROFILE_MAX_METADATA_SOURCES,
  PERSONALITY_PROFILE_MAX_TEXT_SAMPLE_CHARACTERS,
  PERSONALITY_PROFILE_MAX_TEXT_SAMPLES,
  PERSONALITY_PROFILE_MAX_TOTAL_TEXT_CHARACTERS,
  PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES,
  PERSONALITY_PROFILE_MIN_NEW_ENTRIES,
  selectPersonalitySources,
  type PersonalityProfileGenerator,
  type PersonalityProfileRepository,
} from '../PersonalityProfileService'

const NOW = new Date('2026-11-17T12:00:00.000Z')
const EXECUTION_AT = new Date(NOW.getTime() + 1)
const ENTRY_IDS = Array.from(
  { length: PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES + 2 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
)

function sources(count = PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES, userId = 'user-1') {
  return ENTRY_IDS.slice(0, count).map((id, index) => ({
    id,
    userId,
    entryDate: new Date(Date.UTC(2026, 0, index + 1)),
    analyzedAt: new Date(Date.UTC(2026, 0, index + 1, 1)),
    summary: [`Entry ${index + 1} summary`],
    themes: ['reflection'],
    body: `Entry ${index + 1} body`,
    deletedAt: null,
  }))
}

function output(entryIds = ENTRY_IDS) {
  return {
    traits: BIG_FIVE_TRAITS.map((trait, index) => ({
      trait,
      score: 40 + index,
      level: 'High',
      evidenceEntryIds: [entryIds[index]],
    })),
    summary: 'Your entries suggest thoughtful recurring patterns.',
    meaning: 'This reflection is grounded in the entries selected for this profile.',
  }
}

function repository(
  overrides: Partial<PersonalityProfileRepository> = {},
): PersonalityProfileRepository {
  return {
    findProfile: vi
      .fn()
      .mockResolvedValue({ generatedAt: null, generatingAt: NOW, retryAfter: null }),
    countAnalyzedEntries: vi.fn().mockResolvedValue(PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES),
    ensureProfile: vi.fn().mockResolvedValue(undefined),
    claimGeneration: vi.fn().mockResolvedValue(true),
    activateGeneration: vi.fn().mockResolvedValue(true),
    loadSources: vi.fn().mockResolvedValue(sources()),
    filterEligibleSourceIds: vi
      .fn()
      .mockImplementation(async (_userId: string, sourceEntryIds: string[]) => sourceEntryIds),
    saveProfile: vi.fn().mockResolvedValue(true),
    failGeneration: vi.fn().mockResolvedValue(undefined),
    failClaim: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const log = { warn: vi.fn() } as unknown as IMastraLogger

function service(repositoryOverride?: PersonalityProfileRepository, now: () => Date = () => NOW) {
  return new PersonalityProfileService(repositoryOverride, log, now)
}

describe('PersonalityProfileService staleness and claims', () => {
  it.each([
    [PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES - 1, 1],
    [PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES, 0],
    [PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES + 1, 0],
  ])('reports correct shortfall for %i analyzed entries', async (count, expectedMissing) => {
    const fakeRepository = repository({ countAnalyzedEntries: vi.fn().mockResolvedValue(count) })
    await expect(service(fakeRepository).remainingEntries('user-1')).resolves.toBe(expectedMissing)
  })

  it('starts the first profile exactly at the minimum', async () => {
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({ generatedAt: null, generatingAt: null }),
    })

    await expect(service(fakeRepository).isStale('user-1')).resolves.toBe(true)
    await expect(service(fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'claimed',
      claimedAt: NOW,
    })
  })

  it('does not start a profile below the minimum', async () => {
    const fakeRepository = repository({
      countAnalyzedEntries: vi.fn().mockResolvedValue(PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES - 1),
    })

    await expect(service(fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'not_enough_entries',
      missingEntries: 1,
    })
    expect(fakeRepository.ensureProfile).not.toHaveBeenCalled()
  })

  it('does not claim while a durable retry cooldown is active', async () => {
    const retryAfter = new Date(NOW.getTime() + PERSONALITY_PROFILE_FAILURE_COOLDOWN_MS)
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({ generatedAt: null, generatingAt: null, retryAfter }),
    })

    await expect(service(fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'cooldown',
      retryAfter,
    })
    expect(fakeRepository.claimGeneration).not.toHaveBeenCalled()
  })

  it('claims again as soon as the retry cooldown expires', async () => {
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({
        generatedAt: null,
        generatingAt: null,
        retryAfter: new Date(NOW.getTime() - 1),
      }),
    })

    await expect(service(fakeRepository).tryStart('user-1')).resolves.toMatchObject({
      status: 'claimed',
    })
    expect(fakeRepository.claimGeneration).toHaveBeenCalledOnce()
  })

  it('fences scheduler cleanup to its original claim', async () => {
    const fakeRepository = repository()
    await service(fakeRepository).failClaim('user-1', NOW)
    expect(fakeRepository.failClaim).toHaveBeenCalledWith(
      'user-1',
      NOW,
      new Date(NOW.getTime() + PERSONALITY_PROFILE_FAILURE_COOLDOWN_MS),
    )
  })

  it('requires both exact age and new-analysis thresholds before regenerating', async () => {
    const generatedAt = new Date(NOW.getTime() - PERSONALITY_PROFILE_MAX_AGE_MS)
    const countAnalyzedEntries = vi
      .fn()
      .mockResolvedValueOnce(PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES)
      .mockResolvedValueOnce(PERSONALITY_PROFILE_MIN_NEW_ENTRIES - 1)
      .mockResolvedValueOnce(PERSONALITY_PROFILE_MIN_ANALYZED_ENTRIES)
      .mockResolvedValueOnce(PERSONALITY_PROFILE_MIN_NEW_ENTRIES)
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({ generatedAt, generatingAt: null }),
      countAnalyzedEntries,
    })

    await expect(service(fakeRepository).isStale('user-1')).resolves.toBe(false)
    await expect(service(fakeRepository).isStale('user-1')).resolves.toBe(true)
    expect(countAnalyzedEntries).toHaveBeenLastCalledWith('user-1', generatedAt)
  })

  it('does not regenerate a profile younger than thirty days', async () => {
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({
        generatedAt: new Date(NOW.getTime() - PERSONALITY_PROFILE_MAX_AGE_MS + 1),
        generatingAt: null,
      }),
    })

    await expect(service(fakeRepository).isStale('user-1')).resolves.toBe(false)
    expect(fakeRepository.countAnalyzedEntries).toHaveBeenCalledTimes(1)
  })

  it('uses an atomic claim and reports a concurrent generation', async () => {
    const fakeRepository = repository({ claimGeneration: vi.fn().mockResolvedValue(false) })

    await expect(service(fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'generation_in_progress',
    })
    expect(fakeRepository.claimGeneration).toHaveBeenCalledWith({
      userId: 'user-1',
      claimedAt: NOW,
      lockExpiresBefore: new Date(NOW.getTime() - PERSONALITY_PROFILE_LOCK_TIMEOUT_MS),
    })
  })

  it('permits stale-lock recovery through the atomic claim', async () => {
    const recoveryTime = new Date(NOW.getTime() + PERSONALITY_PROFILE_LOCK_TIMEOUT_MS + 1)
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({ generatedAt: null, generatingAt: NOW }),
    })

    await expect(service(fakeRepository, () => recoveryTime).tryStart('user-1')).resolves.toEqual({
      status: 'claimed',
      claimedAt: recoveryTime,
    })
    expect(fakeRepository.claimGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        lockExpiresBefore: new Date(recoveryTime.getTime() - PERSONALITY_PROFILE_LOCK_TIMEOUT_MS),
      }),
    )
  })
})

describe('PersonalityProfileService generation fencing', () => {
  it('rejects a duplicate worker after only one activation succeeds', async () => {
    let release: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      release = resolve
    })
    const generate = vi.fn<PersonalityProfileGenerator>().mockImplementation(async () => {
      await started
      return { output: output() }
    })
    const fakeRepository = repository({
      activateGeneration: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    })
    const profileService = service(fakeRepository)

    const first = profileService.generateClaimedProfile('user-1', NOW, 'test-model', generate)
    await vi.waitFor(() => expect(fakeRepository.activateGeneration).toHaveBeenCalledOnce())
    await expect(
      profileService.generateClaimedProfile('user-1', NOW, 'test-model', generate),
    ).resolves.toBe('failed')
    expect(generate).toHaveBeenCalledOnce()

    release?.()
    await expect(first).resolves.toBe('generated')
  })

  it('rejects a stale claimed worker before it can invoke the generator', async () => {
    const staleClaimedAt = new Date(NOW.getTime() - PERSONALITY_PROFILE_LOCK_TIMEOUT_MS - 1)
    const fakeRepository = repository({
      findProfile: vi.fn().mockResolvedValue({ generatedAt: null, generatingAt: staleClaimedAt }),
    })
    const generate = vi.fn<PersonalityProfileGenerator>()

    await expect(
      service(fakeRepository).generateClaimedProfile(
        'user-1',
        staleClaimedAt,
        'test-model',
        generate,
      ),
    ).resolves.toBe('failed')
    expect(fakeRepository.activateGeneration).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not invoke generation when sources fall below the minimum', async () => {
    const generate = vi.fn<PersonalityProfileGenerator>()
    const fakeRepository = repository({ loadSources: vi.fn().mockResolvedValue(sources(19)) })

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', generate),
    ).resolves.toBe('insufficient_entries')
    expect(generate).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith('user-1', EXECUTION_AT, null)
  })

  it('preserves the previous profile when generation is rate-limited or invalid', async () => {
    const fakeRepository = repository()
    const profileService = service(fakeRepository)

    await expect(
      profileService.generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        rateLimited: true,
      })),
    ).resolves.toBe('rate_limited')
    expect(fakeRepository.saveProfile).not.toHaveBeenCalled()

    await expect(
      profileService.generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        output: output(['00000000-0000-4000-8000-999999999999']),
      })),
    ).resolves.toBe('insufficient_evidence')
    expect(fakeRepository.saveProfile).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith(
      'user-1',
      EXECUTION_AT,
      new Date(NOW.getTime() + 5 * 60 * 1000),
    )
  })

  it('uses a provider reset deadline when a rate limit supplies one', async () => {
    const fakeRepository = repository()
    const retryAfter = new Date(NOW.getTime() + 60 * 60 * 1000)

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        rateLimited: true,
        retryAfter,
      })),
    ).resolves.toBe('rate_limited')
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith('user-1', EXECUTION_AT, retryAfter)
  })

  it('rejects prohibited claims before they can persist a profile', async () => {
    const fakeRepository = repository()
    const unsafeOutput = { ...output(), summary: 'Your entries diagnose depression.' }

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        output: unsafeOutput,
      })),
    ).resolves.toBe('insufficient_evidence')
    expect(fakeRepository.saveProfile).not.toHaveBeenCalled()
  })

  it('does not persist after a fenced save loses its claim', async () => {
    const fakeRepository = repository({ saveProfile: vi.fn().mockResolvedValue(false) })

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        output: output(),
      })),
    ).resolves.toBe('failed')
    expect(fakeRepository.failGeneration).not.toHaveBeenCalled()
  })

  it('rejects persistence when a source is deleted or loses ownership during generation', async () => {
    const fakeRepository = repository({
      filterEligibleSourceIds: vi.fn().mockResolvedValue(ENTRY_IDS.slice(0, 19)),
    })

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', async () => ({
        output: output(),
      })),
    ).resolves.toBe('insufficient_evidence')
    expect(fakeRepository.saveProfile).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith(
      'user-1',
      EXECUTION_AT,
      new Date(NOW.getTime() + 5 * 60 * 1000),
    )
  })

  it('releases the fenced claim after a bounded model timeout', async () => {
    const fakeRepository = repository()

    await expect(
      service(fakeRepository).generateClaimedProfile('user-1', NOW, 'test-model', async () => {
        throw new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 180_000 })
      }),
    ).resolves.toBe('timed_out')
    expect(fakeRepository.saveProfile).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith(
      'user-1',
      EXECUTION_AT,
      new Date(NOW.getTime() + 5 * 60 * 1000),
    )
  })
})

describe('selectPersonalitySources', () => {
  it('keeps only eligible user-owned entries and bounds deterministic metadata and text sources', () => {
    const candidates = Array.from({ length: 102 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      userId: index === 100 ? 'other-user' : 'user-1',
      entryDate: new Date(Date.UTC(2026, 0, index + 1)),
      analyzedAt: new Date(Date.UTC(2026, 0, index + 1, 1)),
      summary: [`Summary ${index + 1}`],
      themes: ['theme'],
      body: 'x'.repeat(PERSONALITY_PROFILE_MAX_TEXT_SAMPLE_CHARACTERS + 100),
      deletedAt: index === 101 ? NOW : null,
    }))

    const result = selectPersonalitySources(candidates.reverse(), 'user-1')

    expect(result.metadataSources).toHaveLength(PERSONALITY_PROFILE_MAX_METADATA_SOURCES)
    expect(result.metadataSources[0]?.id).toBe(candidates[101].id)
    expect(result.textSamples).toHaveLength(PERSONALITY_PROFILE_MAX_TEXT_SAMPLES)
    expect(
      result.textSamples.every(
        ({ text }) => text.length <= PERSONALITY_PROFILE_MAX_TEXT_SAMPLE_CHARACTERS,
      ),
    ).toBe(true)
    expect(
      result.textSamples.reduce((total, { text }) => total + text.length, 0),
    ).toBeLessThanOrEqual(PERSONALITY_PROFILE_MAX_TOTAL_TEXT_CHARACTERS)
    expect(result.sourceEntryIds).not.toContain(candidates[0].id)
    expect(result.sourceEntryIds).not.toContain(candidates[1].id)
  })
})
