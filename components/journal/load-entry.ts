import 'server-only'

import { TRPCError } from '@trpc/server'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { getQueryClient, trpc } from '@/src/server/trpc/server'
import type { SavedEntry } from './use-entry-autosave'

function errorCode(error: unknown) {
  if (error instanceof TRPCError) return error.code
  return (error as { data?: { code?: string } } | null)?.data?.code
}

/**
 * Loads an entry for an editor page and primes the query cache with it (dehydrate
 * `getQueryClient()` to hand it to the editor). One lookup per request, so `generateMetadata` and
 * the page can share it. A missing, deleted or someone else's entry (or a malformed id) is a 404.
 */
export const loadEntry = cache(async (id: string): Promise<SavedEntry> => {
  try {
    const entry = await getQueryClient().fetchQuery(trpc.v1.entry.findOne.queryOptions({ id }))

    return {
      id: entry.id,
      title: entry.title,
      body: entry.body,
      writtenAt: new Date(entry.writtenAt).toISOString(),
      tags: entry.tags.map((tag) => tag.name),
    }
  } catch (error) {
    const code = errorCode(error)
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') notFound()
    if (code === 'UNAUTHORIZED') redirect('/login')
    throw error
  }
})
