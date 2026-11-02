import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { Rise } from '@/components/motion'
import { AiLabel } from '@/components/ui/ai'
import { Card, CardHeading } from '@/components/ui/card'
import { BarList } from '@/components/insights/bar-list'
import { personality } from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Personality' }

export default function PersonalityPage() {
  return (
    <Page>
      <InsightsHeader />
      <p className="text-[13px] text-neutral-400">
        Based on {personality.basedOn} entries · Last updated {personality.updated}
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Rise>
          <Card className="flex flex-col gap-5 lg:p-6">
            <CardHeading>The Big Five</CardHeading>
            <BarList
              tone="cloud"
              data={personality.traits.map((t) => ({
                label: t.trait,
                value: t.pct,
                meta: t.level,
              }))}
              seriesLabel="Trait score"
              unit=""
              label={`The Big Five: ${personality.traits.map((t) => `${t.trait} ${t.level}`).join(', ')}.`}
            />
          </Card>
        </Rise>
        <Rise i={1}>
          <Card className="flex flex-col gap-3 lg:p-6">
            <AiLabel />
            <CardHeading>What this means</CardHeading>
            <p className="font-serif text-[18px] leading-relaxed text-neutral-900 italic">
              {personality.meaning}
            </p>
          </Card>
        </Rise>
      </div>
    </Page>
  )
}
