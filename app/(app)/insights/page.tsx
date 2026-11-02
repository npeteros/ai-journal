import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { FlameIcon } from '@/components/brand/icons'
import { InsightsHeader } from '@/components/insights/insights-header'
import { LineChart } from '@/components/insights/line-chart'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Card, CardHeading } from '@/components/ui/card'
import { MoodDot } from '@/components/ui/chip'
import { StatCard } from '@/components/ui/data'
import { BarList } from '@/components/insights/bar-list'
import { moodLabel } from '@/src/lib/design-tokens/colors'
import { moodMix, moodThisWeek, topThemes } from '@/src/lib/placeholder/insights'
import { placeholderUser } from '@/src/lib/placeholder/user'

export const metadata: Metadata = { title: 'Insights' }

export default function InsightsOverviewPage() {
  return (
    <Page>
      <InsightsHeader />

      <div className="mt-[104px] grid gap-5 lg:mt-[88px] lg:grid-cols-[2fr_1fr]">
        <Rise className="relative">
          <JadenPerch width={PLACEMENTS.insights.size} position={{ right: 24 }}>
            <JadenFor placement="insights" />
          </JadenPerch>
          <Card className="flex flex-col gap-3 lg:p-6">
            <CardHeading>Mood, this week</CardHeading>
            <LineChart
              data={moodThisWeek}
              points
              label="Mood this week: lowest on Friday, highest on Thursday."
            />
          </Card>
        </Rise>

        <div className="grid grid-cols-2 gap-5 lg:grid-cols-1">
          <Rise i={1} className="h-full">
            <StatCard
              className="h-full justify-center"
              value={placeholderUser.entriesThisMonth}
              label="entries this month"
            />
          </Rise>
          <Rise i={2} className="h-full">
            <StatCard
              className="h-full justify-center"
              value={placeholderUser.streakDays}
              label="day streak"
              icon={<FlameIcon size={22} className="lv-flame text-amber-500" />}
            />
          </Rise>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Rise i={3}>
          <Card className="flex h-full flex-col gap-4">
            <CardHeading>Mood mix</CardHeading>
            <ul className="flex flex-wrap gap-2">
              {moodMix.map((m) => (
                <li
                  key={m.mood}
                  className="flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-2"
                >
                  <MoodDot mood={m.mood} size={8} />
                  <span className="text-[13px] font-semibold text-neutral-600">
                    {moodLabel[m.mood]} · {m.count}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Rise>
        <Rise i={4}>
          <Card className="flex h-full flex-col gap-4">
            <CardHeading>Top themes this week</CardHeading>
            <BarList
              data={topThemes.map((t) => ({ label: t.label, value: t.pct }))}
              seriesLabel="Share of entries"
              label={`Top themes this week: ${topThemes.map((t) => `${t.label} ${t.pct}%`).join(', ')}.`}
            />
          </Card>
        </Rise>
      </div>
    </Page>
  )
}
