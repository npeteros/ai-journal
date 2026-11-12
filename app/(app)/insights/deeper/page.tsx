import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { EmotionalTrendCard } from '@/components/insights/emotional-trend-card'
import { ForYouSuggestion, RecurringThemes } from '@/components/insights/insight-report'
import { InsightsHeader } from '@/components/insights/insights-header'
import { Rise } from '@/components/motion'
import { Card, CardHeading } from '@/components/ui/card'
import { BarList } from '@/components/insights/bar-list'
import { personality, personalitySnapshot } from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Deeper insights' }

export default function DeeperInsightsPage() {
  return (
    <Page>
      <InsightsHeader />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <Rise>
            <EmotionalTrendCard />
          </Rise>

          <Rise i={1}>
            <RecurringThemes />
          </Rise>
          <p className="text-[12px] text-neutral-400">
            Generated from your entries via cloud AI. Logged in your{' '}
            <Link
              href="/settings/data-privacy"
              className="font-semibold text-cloud-700 hover:underline"
            >
              Processing Log
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <Rise i={2}>
            <Card className="flex flex-col gap-4 lg:p-6">
              <div className="flex items-baseline justify-between">
                <CardHeading>Personality snapshot</CardHeading>
                <span className="text-[12px] text-neutral-400">{personality.basedOn} entries</span>
              </div>
              <BarList
                tone="cloud"
                data={personalitySnapshot.map((t) => ({
                  label: t.trait,
                  value: t.pct,
                  meta: t.level,
                }))}
                seriesLabel="Trait score"
                unit=""
                label={`Personality snapshot: ${personalitySnapshot.map((t) => `${t.trait} ${t.level}`).join(', ')}.`}
              />
              <p className="text-[13px] leading-normal text-neutral-600">{personality.summary}</p>
            </Card>
          </Rise>

          <Rise i={3}>
            <ForYouSuggestion />
          </Rise>
        </div>
      </div>
    </Page>
  )
}
