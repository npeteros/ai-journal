import { TRPCError } from '@trpc/server'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { Page } from '@/components/app-shell/page'
import { EntryEditor } from '@/components/journal/entry-editor'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

function errorCode(error: unknown) {
  if (error instanceof TRPCError) return error.code
  return (error as { data?: { code?: string } } | null)?.data?.code
}

/** One lookup per request, shared by `generateMetadata` and the page. */
const loadEntry = cache(async (id: string) => {
  try {
    const entry = await getQueryClient().fetchQuery(trpc.v1.entry.findOne.queryOptions({ id }))

    return {
      id: entry.id,
      title: entry.title,
      body: entry.body,
      writtenAt: new Date(entry.writtenAt).toISOString(),
      tags: entry.tags.map((tag) => tag.name),
      moodScore: entry.analysis?.moodScore ?? null,
    }
  } catch (error) {
    const code = errorCode(error)
    // A missing, deleted or someone else's entry (or a malformed id) all look the same.
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') notFound()
    if (code === 'UNAUTHORIZED') redirect('/login')
    throw error
  }
})

export async function generateMetadata(props: PageProps<'/journal/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const { title } = await loadEntry(id)
  return { title }
}

export default async function EntryPage(props: PageProps<'/journal/[id]'>) {
  const { id } = await props.params
  const { moodScore, ...entry } = await loadEntry(id)

  return (
    <Page className="lg:pt-8">
      <EntryEditor entry={entry} moodScore={moodScore} />
    </Page>
  )
}
