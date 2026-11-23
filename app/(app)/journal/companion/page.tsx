import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { EntryEditor } from '@/components/journal/entry-editor'
import { loadEntry } from '@/components/journal/load-entry'
import { getQueryClient } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'JADEN companion' }

/**
 * Writing with the companion: the entry editor, with JADEN offering a follow-up question as you
 * write. `?entry=<id>` continues an existing entry; without it, a new entry is created on the
 * first autosave (and the URL gains `?entry=`).
 */
export default async function CompanionPage(props: PageProps<'/journal/companion'>) {
  const { entry: entryParam } = await props.searchParams
  const entryId = typeof entryParam === 'string' ? entryParam : undefined
  const entry = entryId ? await loadEntry(entryId) : undefined

  return (
    <Page className="lg:pt-8">
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        {/* Keyed so switching entries remounts the editor with fresh state. */}
        <EntryEditor key={entry?.id ?? 'new'} entry={entry} mode="companion" />
      </HydrationBoundary>
    </Page>
  )
}
