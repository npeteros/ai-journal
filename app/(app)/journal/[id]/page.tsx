import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { EntryEditor } from '@/components/journal/entry-editor'
import { loadEntry } from '@/components/journal/load-entry'
import { getQueryClient } from '@/src/server/trpc/server'

export async function generateMetadata(props: PageProps<'/journal/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const { title } = await loadEntry(id)
  return { title }
}

export default async function EntryPage(props: PageProps<'/journal/[id]'>) {
  const { id } = await props.params
  const entry = await loadEntry(id)

  return (
    <Page className="lg:pt-8">
      {/* Hands the entry (and its analysis) to the editor's query cache, so the side panel
          renders without a second request. */}
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <EntryEditor entry={entry} />
      </HydrationBoundary>
    </Page>
  )
}
