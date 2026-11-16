import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { EntryEditor } from '@/components/journal/entry-editor'

export const metadata: Metadata = { title: 'New entry' }

export default function NewEntryPage() {
  return (
    <Page className="lg:pt-8">
      <EntryEditor />
    </Page>
  )
}
