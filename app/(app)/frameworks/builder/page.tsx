import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { FrameworkBuilder } from '@/components/frameworks/framework-builder'
import { builderDraft } from '@/src/lib/placeholder/frameworks'

export const metadata: Metadata = { title: 'New framework' }

export default function FrameworkBuilderPage() {
  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkBuilder initial={builderDraft} />
    </Page>
  )
}
