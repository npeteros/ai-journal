import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { LineChart } from '@/components/insights/line-chart'
import { Rise } from '@/components/motion'
import { Card, CardHeading } from '@/components/ui/card'
import { TrendBadge } from '@/components/ui/data'
import { BarList } from '@/components/insights/bar-list'
import {
  emotionalTrend,
  emotionalTrendCaption,
  growthSuggestions,
  personality,
  personalitySnapshot,
  recurringThemes,
} from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Deeper insights' }

export default function DeeperInsightsPage() {
  const forYou = growthSuggestions[0]

  return (
    <Page>
      <InsightsHeader />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          <Rise>
            <Card className="flex flex-col gap-3 lg:p-6">
              <CardHeading>Emotional trend, last 6 months</CardHeading>
              <LineChart
                data={emotionalTrend}
                tone="cloud-500"
                height={160}
                label={emotionalTrendCaption}
              />
              <p className="text-[13px] leading-normal text-neutral-600">{emotionalTrendCaption}</p>
            </Card>
          </Rise>

          <Rise i={1}>
            <Card className="flex flex-col gap-1 lg:p-6">
              <CardHeading className="mb-2">Recurring themes</CardHeading>
              <ul className="divide-y divide-neutral-200">
                {recurringThemes.map((t) => (
                  <li key={t.title} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-semibold text-neutral-900">{t.title}</span>
                      <span className="text-[12px] text-neutral-400">
                        Mentioned in {t.mentions} entries
                      </span>
                    </div>
                    <TrendBadge trend={t.trend} />
                  </li>
                ))}
              </ul>
            </Card>
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
            <Card className="flex flex-col gap-2 bg-[linear-gradient(160deg,var(--sage-100),var(--cloud-100))] lg:p-6">
              <span className="text-[11px] font-bold tracking-[0.08em] text-sage-700 uppercase">
                For you
              </span>
              <p className="font-serif text-[18px] leading-snug font-semibold text-neutral-900">
                {forYou.title}
              </p>
              <p className="text-[13px] leading-normal text-neutral-600">{forYou.short}</p>
              <Link
                href="/insights/growth"
                className="mt-1 text-[13px] font-semibold text-cloud-700 hover:underline"
              >
                View all suggestions →
              </Link>
            </Card>
          </Rise>
        </div>
      </div>
    </Page>
  )
}
