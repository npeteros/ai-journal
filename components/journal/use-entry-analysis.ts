'use client'

import { skipToken, useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/src/server/trpc/client'

/**
 * The entry's analysis (mood, summary, suggested tags), or null when it has none yet.
 *
 * Reads `v1.entry.findOne`, the same query the autosave hook polls after a save, so a fresh
 * analysis shows up here without a reload. A new entry has no id until its first save.
 */
export function useEntryAnalysis(entryId: string | null) {
  const trpc = useTRPC()
  const { data } = useQuery({
    ...trpc.v1.entry.findOne.queryOptions(entryId === null ? skipToken : { id: entryId }),
    select: (entry) => entry.analysis,
  })
  return data ?? null
}
