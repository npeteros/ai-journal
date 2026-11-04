import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Page } from '@/components/app-shell/page'
import { EntryEditor } from '@/components/journal/entry-editor'
import {
  PLACEHOLDER_NOW_ISO,
  getPlaceholderEntry,
  placeholderEntries,
} from '@/src/lib/placeholder/entries'

export async function generateMetadata(props: PageProps<'/journal/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  return { title: getPlaceholderEntry(id)?.title ?? 'Entry' }
}

export function generateStaticParams() {
  return placeholderEntries.map((e) => ({ id: e.id }))
}

export default async function EntryPage(props: PageProps<'/journal/[id]'>) {
  const { id } = await props.params
  const entry = getPlaceholderEntry(id)
  if (!entry) notFound()

  return (
    <Page className="lg:pt-8">
      <EntryEditor entry={entry} now={PLACEHOLDER_NOW_ISO} />
    </Page>
  )
}
