import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { GrowthSuggestions } from '@/components/insights/insight-report'
import { InsightsHeader } from '@/components/insights/insights-header'

export const metadata: Metadata = { title: 'Growth' }

export default function GrowthPage() {
  return (
    <Page>
      <InsightsHeader />
      <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
        A few gentle suggestions based on what you&apos;ve been writing about lately.
      </p>

      <div className="mt-16">
        <GrowthSuggestions />
      </div>
    </Page>
  )
}
