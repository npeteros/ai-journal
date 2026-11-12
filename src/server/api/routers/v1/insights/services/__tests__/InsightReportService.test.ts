// @vitest-environment node
import type { IMastraLogger } from '@mastra/core/logger'
import { MastraTimeoutError } from '@mastra/core/loop'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))

import {
  InsightReportService,
  INSIGHT_REPORT_LEASE_MS,
  INSIGHT_REPORT_LEASE_SAFETY_MS,
  insightReportLimits,
  insightReportWindows,
  selectInsightSources,
  type InsightReportAgentCall,
  type InsightReportLimits,
  type InsightReportRepository,
} from '../InsightReportService'

const NOW = new Date('2026-02-10T14:30:00.000Z')
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
    claimRefresh: vi.fn().mockResolvedValue('claimed'),
    loadSources: vi.fn().mockResolvedValue({ current: sources, previousThemes: [] }),
    saveReport: vi.fn().mockResolvedValue(true),
    releaseRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const log = { warn: vi.fn() } as unknown as IMastraLogger

const TEST_LIMITS: InsightReportLimits = { maxSourceEntries: 50, generationTimeoutMs: 600_000 }

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

  it('clamps environment configuration to preserve the evidence minimum and lease safety margin', () => {
    expect(
      insightReportLimits({
        INSIGHT_REPORT_MAX_SOURCE_ENTRIES: '2',
        INSIGHT_REPORT_GENERATION_TIMEOUT_MS: String(INSIGHT_REPORT_LEASE_MS),
      }),
    ).toEqual({
      maxSourceEntries: 5,
      generationTimeoutMs: INSIGHT_REPORT_LEASE_MS - INSIGHT_REPORT_LEASE_SAFETY_MS,
    })
  })

  it('requires five current analyzed entries without calling AI', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>()
    const fakeRepository = repository({
      loadSources: vi.fn().mockResolvedValue({ current: sources.slice(0, 4), previousThemes: [] }),
    })

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe(
      'insufficient_entries',
    )
    expect(callAgent).not.toHaveBeenCalled()
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('selects the most recent bounded sources while preserving chronological order', () => {
    const sourceSet = [
      { ...sources[5 - 1], id: ENTRY_IDS[4], date: '2026-01-20' },
      { ...sources[0], id: ENTRY_IDS[0], date: '2026-01-15' },
      { ...sources[3], id: ENTRY_IDS[3], date: '2026-01-19' },
      { ...sources[1], id: ENTRY_IDS[1], date: '2026-01-16' },
      { ...sources[2], id: ENTRY_IDS[2], date: '2026-01-18' },
      {
        ...sources[0],
        id: '00000000-0000-4000-8000-000000000006',
        date: '2026-01-17',
      },
      {
        ...sources[0],
        id: '00000000-0000-4000-8000-000000000007',
        date: '2026-01-21',
      },
    ]

    expect(selectInsightSources(sourceSet, 5).map(({ date }) => date)).toEqual([
      '2026-01-17',
      '2026-01-18',
      '2026-01-19',
      '2026-01-20',
      '2026-01-21',
    ])
  })

  it('persists only reports grounded in the current user-owned sources', async () => {
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

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe('generated')
    expect(fakeRepository.saveReport).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.objectContaining({
        entryCount: 5,
        recurringThemes: [
          expect.objectContaining({ mentions: 2, entryIds: ENTRY_IDS.slice(0, 2) }),
        ],
      }),
    )
    expect(fakeRepository.releaseRefresh).not.toHaveBeenCalled()
  })

  it('stores the selected input count and refuses evidence from entries truncated out of the prompt', async () => {
    const extra = {
      ...sources[0],
      id: '00000000-0000-4000-8000-000000000006',
      date: '2026-02-06',
    }
    const sixSources = [...sources, extra]
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          {
            title: 'Excluded source',
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
      loadSources: vi.fn().mockResolvedValue({ current: sixSources, previousThemes: [] }),
    })

    await expect(
      service(callAgent, fakeRepository, {
        maxSourceEntries: 5,
        generationTimeoutMs: 600_000,
      }).refresh('user-1'),
    ).resolves.toBe('insufficient_evidence')
    expect(callAgent).toHaveBeenCalledWith(
      expect.objectContaining({ entries: sixSources.slice(1), timeoutMs: 600_000 }),
    )
    expect(fakeRepository.saveReport).not.toHaveBeenCalled()
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('persists the selected prompt count instead of every eligible entry in the period', async () => {
    const extra = {
      ...sources[0],
      id: '00000000-0000-4000-8000-000000000006',
      date: '2026-02-06',
    }
    const sixSources = [...sources, extra]
    const selectedIds = sixSources.slice(1).map(({ id }) => id)
    const callAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      object: {
        recurringThemes: [
          {
            title: 'Work boundaries',
            mentions: 2,
            trend: 'steady',
            entryIds: selectedIds.slice(0, 2),
          },
        ],
        growthSuggestions: [],
        trendCaption: null,
      },
    })
    const fakeRepository = repository({
      loadSources: vi.fn().mockResolvedValue({ current: sixSources, previousThemes: [] }),
    })

    await expect(
      service(callAgent, fakeRepository, {
        maxSourceEntries: 5,
        generationTimeoutMs: 600_000,
      }).refresh('user-1'),
    ).resolves.toBe('generated')
    expect(fakeRepository.saveReport).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.objectContaining({ entryCount: 5 }),
    )
  })

  it('rejects model items that cite an entry outside the user-owned source set', async () => {
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

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe(
      'insufficient_evidence',
    )
    expect(fakeRepository.saveReport).not.toHaveBeenCalled()
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('does not call AI while an existing report is still within the refresh cooldown', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>()
    const fakeRepository = repository({ claimRefresh: vi.fn().mockResolvedValue('cooldown') })

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe('cooldown')
    expect(callAgent).not.toHaveBeenCalled()
    expect(fakeRepository.releaseRefresh).not.toHaveBeenCalled()
  })

  it('returns timed_out and releases the lease when Mastra enforces the model deadline', async () => {
    const callAgent = vi
      .fn<InsightReportAgentCall>()
      .mockRejectedValue(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: 600_000 }))
    const fakeRepository = repository()

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe('timed_out')
    expect(callAgent).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 600_000 }))
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('does not begin a model call once source loading has consumed the lease safety margin', async () => {
    const callAgent = vi.fn<InsightReportAgentCall>()
    const fakeRepository = repository()
    const deadlinePassed = new Date(
      NOW.getTime() + INSIGHT_REPORT_LEASE_MS - INSIGHT_REPORT_LEASE_SAFETY_MS + 1,
    )
    const times = [NOW, deadlinePassed, deadlinePassed]

    await expect(
      service(
        callAgent,
        fakeRepository,
        TEST_LIMITS,
        () => times.shift() ?? deadlinePassed,
      ).refresh('user-1'),
    ).resolves.toBe('timed_out')
    expect(callAgent).not.toHaveBeenCalled()
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('releases its lease when the model is rate limited or fails', async () => {
    const rateLimitedAgent = vi.fn<InsightReportAgentCall>().mockResolvedValue({
      tripwire: { processorId: 'ai-usage', metadata: { code: 'TOO_MANY_REQUESTS' } },
    })
    const rateLimitedRepository = repository()
    await expect(service(rateLimitedAgent, rateLimitedRepository).refresh('user-1')).resolves.toBe(
      'rate_limited',
    )
    expect(rateLimitedRepository.releaseRefresh).toHaveBeenCalledOnce()

    const failingAgent = vi
      .fn<InsightReportAgentCall>()
      .mockRejectedValue(new Error('provider failed'))
    const failingRepository = repository()
    await expect(service(failingAgent, failingRepository).refresh('user-1')).resolves.toBe('failed')
    expect(failingRepository.releaseRefresh).toHaveBeenCalledOnce()
  })

  it('cleans up a lease that expires before a late model result can be persisted', async () => {
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
    const fakeRepository = repository({ saveReport: vi.fn().mockResolvedValue(false) })

    await expect(service(callAgent, fakeRepository).refresh('user-1')).resolves.toBe('failed')
    expect(callAgent).toHaveBeenCalledOnce()
    expect(fakeRepository.releaseRefresh).toHaveBeenCalledOnce()
  })
})
