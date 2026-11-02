import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Card } from '@/components/ui/card'
import { growthSuggestions } from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Growth' }

export default function GrowthPage() {
  return (
    <Page>
      <InsightsHeader />
      <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600">
        A few gentle suggestions based on what you&apos;ve been writing about lately.
      </p>

      <ul className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {growthSuggestions.map((s, i) => (
          <li key={s.title}>
            <Rise i={i} className="relative h-full">
              {i === 0 && (
                <JadenPerch width={PLACEMENTS.growth.size} position={{ right: 12 }}>
                  <JadenFor placement="growth" />
                </JadenPerch>
              )}
              <Card className="flex h-full flex-col gap-2.5">
                <h2 className="font-serif text-[18px] leading-snug font-semibold text-neutral-900">
                  {s.title}
                </h2>
                <p className="flex-1 text-[13px] leading-[1.6] text-neutral-600">{s.body}</p>
                <Link
                  href="/journal/new"
                  className="mt-1 text-[13px] font-semibold text-cloud-700 hover:underline"
                >
                  Try this →
                </Link>
              </Card>
            </Rise>
          </li>
        ))}
      </ul>
    </Page>
  )
}
