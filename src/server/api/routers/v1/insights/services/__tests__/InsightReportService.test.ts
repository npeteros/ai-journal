// @vitest-environment node
import type { IMastraLogger } from '@mastra/core/logger'
import { MastraTimeoutError } from '@mastra/core/loop'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))

import {
  InsightReportService,
  INSIGHT_REPORT_LOCK_SAFETY_MS,
  INSIGHT_REPORT_LOCK_TIMEOUT_MS,
  INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS,
  INSIGHT_REPORT_MAX_AGE_MS,
  INSIGHT_REPORT_MIN_NEW_ENTRIES,
  insightReportLimits,
  insightReportWindows,
  type InsightReportAgentCall,
  type InsightReportLimits,
  type InsightReportRepository,
} from '../InsightReportService'

const NOW = new Date('2026-02-10T14:30:00.000Z')
const EXECUTION_AT = new Date(NOW.getTime() + 1)
const ENTRY_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
]

const sources = ENTRY_IDS.map((id, index) => ({
  id,
  date: `2026-02-0${index + 1}`,
  themes: ['work boundaries'],
  summary: ['A short, analyzed journal summary.'],
}))

function repository(overrides: Partial<InsightReportRepository> = {}): InsightReportRepository {
  return {
    findReport: vi.fn().mockResolvedValue({
      generatedAt: null,
      generatingAt: NOW,
      lastRefreshAt: null,
    }),
    countAnalyzedEntries: vi.fn().mockResolvedValue(5),
    ensureReport: vi.fn().mockResolvedValue(undefined),
    claimGeneration: vi.fn().mockResolvedValue(true),
    activateGeneration: vi.fn().mockResolvedValue(true),
    loadSources: vi.fn().mockResolvedValue({ current: sources, previousThemes: [] }),
    saveReport: vi.fn().mockResolvedValue(true),
    failGeneration: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const log = { warn: vi.fn() } as unknown as IMastraLogger
const TEST_LIMITS: InsightReportLimits = { maxSourceEntries: 50, generationTimeoutMs: 180_000 }

function service(
  callAgent: InsightReportAgentCall,
  repositoryOverride?: InsightReportRepository,
  limits: InsightReportLimits = TEST_LIMITS,
  now: () => Date = () => NOW,
) {
  return new InsightReportService(callAgent, repositoryOverride, log, now, limits)
}

describe('InsightReportService', () => {
  it('uses consecutive, inclusive UTC 30-day windows', () => {
    expect(insightReportWindows(NOW)).toMatchObject({
      currentStart: new Date('2026-01-12T00:00:00.000Z'),
      currentEnd: new Date('2026-02-10T00:00:00.000Z'),
      currentEndExclusive: new Date('2026-02-11T00:00:00.000Z'),
      previousStart: new Date('2025-12-13T00:00:00.000Z'),
      previousEndExclusive: new Date('2026-01-12T00:00:00.000Z'),
    })
  })

  it('caps model work at three minutes inside the five-minute stale-lock timeout', () => {
    expect(
      insightReportLimits({
        INSIGHT_REPORT_MAX_SOURCE_ENTRIES: '2',
        INSIGHT_REPORT_GENERATION_TIMEOUT_MS: String(INSIGHT_REPORT_LOCK_TIMEOUT_MS),
      }),
    ).toEqual({ maxSourceEntries: 5, generationTimeoutMs: 180_000 })
    expect(INSIGHT_REPORT_LOCK_TIMEOUT_MS - INSIGHT_REPORT_LOCK_SAFETY_MS).toBe(180_000)
  })

  it('marks an ungenerated report stale only after the entry minimum is met', async () => {
    const fakeRepository = repository({ countAnalyzedEntries: vi.fn().mockResolvedValue(4) })
    await expect(service(vi.fn(), fakeRepository).isStale('user-1')).resolves.toBe(false)

    fakeRepository.countAnalyzedEntries = vi.fn().mockResolvedValue(5)
    await expect(service(vi.fn(), fakeRepository).isStale('user-1')).resolves.toBe(true)
  })

  it('requires age and enough newer analyses before regenerating a successful report', async () => {
    const generatedAt = new Date(NOW.getTime() - INSIGHT_REPORT_MAX_AGE_MS - 1)
    const countAnalyzedEntries = vi
      .fn()
      .mockResolvedValueOnce(INSIGHT_REPORT_MIN_NEW_ENTRIES - 1)
      .mockResolvedValueOnce(INSIGHT_REPORT_MIN_NEW_ENTRIES)
    const fakeRepository = repository({
      findReport: vi
        .fn()
        .mockResolvedValue({ generatedAt, generatingAt: null, lastRefreshAt: null }),
      countAnalyzedEntries,
    })

    await expect(service(vi.fn(), fakeRepository).isStale('user-1')).resolves.toBe(false)
    await expect(service(vi.fn(), fakeRepository).isStale('user-1')).resolves.toBe(true)
    expect(countAnalyzedEntries).toHaveBeenLastCalledWith('user-1', expect.any(Object), generatedAt)
  })

  it('does not regenerate a report younger than seven days', async () => {
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: new Date(NOW.getTime() - INSIGHT_REPORT_MAX_AGE_MS + 1),
        generatingAt: null,
        lastRefreshAt: null,
      }),
    })

    await expect(service(vi.fn(), fakeRepository).isStale('user-1')).resolves.toBe(false)
    expect(fakeRepository.countAnalyzedEntries).not.toHaveBeenCalled()
  })

  it('claims a stale report with a bounded stale-lock recovery window', async () => {
    const fakeRepository = repository()
    const start = await service(vi.fn(), fakeRepository).tryStart('user-1')

    expect(start).toEqual({ status: 'claimed', claimedAt: NOW })
    expect(fakeRepository.ensureReport).toHaveBeenCalledWith('user-1')
    expect(fakeRepository.claimGeneration).toHaveBeenCalledWith({
      userId: 'user-1',
      claimedAt: NOW,
      lockExpiresBefore: new Date(NOW.getTime() - INSIGHT_REPORT_LOCK_TIMEOUT_MS),
      manualRefreshAfter: new Date(NOW.getTime() - INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS),
      isManual: false,
    })
  })

  it('claims an old report after three new analyses even when fewer than five are in the current window', async () => {
    const generatedAt = new Date(NOW.getTime() - INSIGHT_REPORT_MAX_AGE_MS - 1)
    const fakeRepository = repository({
      findReport: vi
        .fn()
        .mockResolvedValue({ generatedAt, generatingAt: null, lastRefreshAt: null }),
      countAnalyzedEntries: vi.fn().mockResolvedValue(INSIGHT_REPORT_MIN_NEW_ENTRIES),
    })

    await expect(service(vi.fn(), fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'claimed',
      claimedAt: NOW,
    })
  })

  it('does not claim automatically when a successful report is still fresh', async () => {
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: new Date(NOW.getTime() - 1),
        generatingAt: null,
        lastRefreshAt: null,
      }),
    })

    await expect(service(vi.fn(), fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'not_stale',
    })
    expect(fakeRepository.claimGeneration).not.toHaveBeenCalled()
  })

  it('enforces the once-per-day manual refresh limit through the atomic claim', async () => {
    const fakeRepository = repository({
      claimGeneration: vi.fn().mockResolvedValue(false),
      findReport: vi.fn().mockResolvedValue({
        generatedAt: NOW,
        generatingAt: null,
        lastRefreshAt: new Date(NOW.getTime() - 1),
      }),
    })

    await expect(
      service(vi.fn(), fakeRepository).tryStart('user-1', { manual: true }),
    ).resolves.toEqual({
      status: 'cooldown',
      nextManualRefreshAt: new Date(NOW.getTime() - 1 + INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS),
    })
    expect(fakeRepository.claimGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        isManual: true,
        manualRefreshAfter: new Date(NOW.getTime() - INSIGHT_REPORT_MANUAL_REFRESH_COOLDOWN_MS),
      }),
    )
  })

  it('returns an entry shortfall without creating a report or calling AI', async () => {
    const fakeRepository = repository({ countAnalyzedEntries: vi.fn().mockResolvedValue(3) })
    const callAgent = vi.fn<InsightReportAgentCall>()

    await expect(service(callAgent, fakeRepository).tryStart('user-1')).resolves.toEqual({
      status: 'not_enough_entries',
      missingEntries: 2,
    })
    expect(fakeRepository.ensureReport).not.toHaveBeenCalled()
    expect(callAgent).not.toHaveBeenCalled()
  })

  it('persists only reports grounded in the claimed user-owned sources', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          {
            title: 'Work boundaries',
            mentions: 99,
            trend: 'rising',
            entryIds: ENTRY_IDS.slice(0, 2),
          },
        ],
        growthSuggestions: [
          {
            title: 'Protect a small pause',
            body: 'You might notice whether a short transition after work gives you more room to reset.',
            short: 'Try a short transition after work.',
            entryIds: ENTRY_IDS.slice(2, 4),
          },
        ],
        trendCaption: 'Work boundaries appeared more often in this period.',
      },
    })
    const fakeRepository = repository()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-a', NOW),
    ).resolves.toBe('generated')
    expect(callAgent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a' }))
    expect(fakeRepository.saveReport).toHaveBeenCalledWith(
      'user-a',
      EXECUTION_AT,
      expect.objectContaining({
        entryCount: 5,
        generatedAt: NOW,
        recurringThemes: [
          expect.objectContaining({ mentions: 2, entryIds: ENTRY_IDS.slice(0, 2) }),
        ],
      }),
    )
  })

  it('does not call AI for an initial report with fewer than five sources', async () => {
    const fakeRepository = repository({
      loadSources: vi.fn().mockResolvedValue({ current: sources.slice(0, 4), previousThemes: [] }),
    })
    const callAgent = vi.fn<InsightReportAgentCall>()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('insufficient_entries')
    expect(callAgent).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith('user-1', EXECUTION_AT, null)
  })

  it.each([3, 4])('regenerates an existing report with %i sources', async (sourceCount) => {
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          {
            title: 'Work boundaries',
            mentions: 1,
            trend: 'steady',
            entryIds: [ENTRY_IDS[0]],
          },
        ],
        growthSuggestions: [],
        trendCaption: null,
      },
    })
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: new Date(NOW.getTime() - INSIGHT_REPORT_MAX_AGE_MS - 1),
        generatingAt: NOW,
        lastRefreshAt: null,
      }),
      loadSources: vi.fn().mockResolvedValue({
        current: sources.slice(0, sourceCount),
        previousThemes: [],
      }),
    })

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('generated')
    expect(callAgent).toHaveBeenCalledOnce()
    expect(fakeRepository.saveReport).toHaveBeenCalledWith(
      'user-1',
      EXECUTION_AT,
      expect.objectContaining({ entryCount: sourceCount }),
    )
  })

  it('does not call AI for an existing report with fewer than three sources', async () => {
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: new Date(NOW.getTime() - INSIGHT_REPORT_MAX_AGE_MS - 1),
        generatingAt: NOW,
        lastRefreshAt: null,
      }),
      loadSources: vi.fn().mockResolvedValue({ current: sources.slice(0, 2), previousThemes: [] }),
    })
    const callAgent = vi.fn<InsightReportAgentCall>()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('insufficient_entries')
    expect(callAgent).not.toHaveBeenCalled()
  })

  it('admits only one concurrent worker for the same claim', async () => {
    let releaseAgent: (() => void) | undefined
    const agentStarted = new Promise<void>((resolve) => {
      releaseAgent = resolve
    })
    const callAgent = vi.fn<InsightReportAgentCall>().mockImplementation(async () => {
      await agentStarted
      return {
        object: {
          recurringThemes: [
            { title: 'Work boundaries', mentions: 1, trend: 'steady', entryIds: [ENTRY_IDS[0]] },
          ],
          growthSuggestions: [],
          trendCaption: null,
        },
      }
    })
    const fakeRepository = repository({
      activateGeneration: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    })

    const firstWorker = service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW)
    await vi.waitFor(() => expect(fakeRepository.activateGeneration).toHaveBeenCalledOnce())
    const duplicateWorker = service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW)

    await expect(duplicateWorker).resolves.toBe('failed')
    expect(callAgent).toHaveBeenCalledOnce()
    releaseAgent?.()
    await expect(firstWorker).resolves.toBe('generated')
    expect(callAgent).toHaveBeenCalledOnce()
  })

  it('rejects a workflow run whose active claim was cleared or replaced', async () => {
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: null,
        generatingAt: new Date(NOW.getTime() - 1),
        lastRefreshAt: null,
      }),
    })
    const callAgent = vi.fn<InsightReportAgentCall>()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('failed')
    expect(callAgent).not.toHaveBeenCalled()
    expect(fakeRepository.saveReport).not.toHaveBeenCalled()
  })

  it('keeps the previous report by recording an ownership validation failure instead of saving', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          {
            title: 'Not grounded',
            mentions: 1,
            trend: 'steady',
            entryIds: ['00000000-0000-4000-8000-000000000099'],
          },
        ],
        growthSuggestions: [],
        trendCaption: null,
      },
    })
    const fakeRepository = repository()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('insufficient_evidence')
    expect(fakeRepository.saveReport).not.toHaveBeenCalled()
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith(
      'user-1',
      EXECUTION_AT,
      'insufficient_evidence',
    )
  })

  it('records sanitized failure state and releases the report-row lock after a timeout', async () => {
    const callAgent = vi
      .fn<InsightReportAgentCall>()
      .mockRejectedValue(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 180_000 }))
    const fakeRepository = repository()

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('timed_out')
    expect(fakeRepository.failGeneration).toHaveBeenCalledWith('user-1', EXECUTION_AT, 'timed_out')
  })

  it('refuses a late worker write after its claim was replaced', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          { title: 'Work boundaries', mentions: 1, trend: 'steady', entryIds: [ENTRY_IDS[0]] },
        ],
        growthSuggestions: [],
        trendCaption: null,
      },
    })
    const fakeRepository = repository({ saveReport: vi.fn().mockResolvedValue(false) })

    await expect(
      service(callAgent, fakeRepository).generateClaimedReport('user-1', NOW),
    ).resolves.toBe('failed')
    expect(fakeRepository.failGeneration).not.toHaveBeenCalled()
  })

  it('allows recovery after an activated worker crashes and its lock becomes stale', async () => {
    const recoveryTime = new Date(EXECUTION_AT.getTime() + INSIGHT_REPORT_LOCK_TIMEOUT_MS + 1)
    const fakeRepository = repository({
      findReport: vi.fn().mockResolvedValue({
        generatedAt: null,
        generatingAt: EXECUTION_AT,
        lastRefreshAt: null,
      }),
    })

    await expect(
      service(vi.fn(), fakeRepository, TEST_LIMITS, () => recoveryTime).tryStart('user-1'),
    ).resolves.toEqual({ status: 'claimed', claimedAt: recoveryTime })
    expect(fakeRepository.claimGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        lockExpiresBefore: new Date(recoveryTime.getTime() - INSIGHT_REPORT_LOCK_TIMEOUT_MS),
      }),
    )
  })
})
