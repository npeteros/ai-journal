import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { InsightsOverview } from '@/components/insights/insights-overview'

export const metadata: Metadata = { title: 'Insights' }

export default function InsightsOverviewPage() {
  return (
    <Page>
      <InsightsHeader />

      <div className="mt-[104px] flex flex-col gap-5 lg:mt-[88px]">
        <InsightsOverview />
      </div>
    </Page>
  )
}
