import type { Metadata } from 'next'
import Link from 'next/link'

import { FlameIcon } from '@/components/brand/icons'
import { Logo } from '@/components/brand/logo'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { weeklyReview } from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Weekly Review email (preview)' }

/**
 * Dev-only preview of the Weekly Review email. Placeholder for layout/copy only — the real email
 * must be built with email-safe HTML (tables, inline styles, no animation) when it's implemented.
 */
export default function WeeklyReviewEmailPreview() {
  const r = weeklyReview
  return (
    <main className="min-h-dvh bg-neutral-100 px-4 py-10">
      <div className="mx-auto flex max-w-[560px] flex-col gap-4">
        <p className="text-[11px] font-bold tracking-[0.08em] text-amber-700 uppercase">
          Dev · Email preview
        </p>

        <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-[12px] text-neutral-600 shadow-soft">
          <span>
            <span className="text-neutral-400">From</span>{' '}
            <strong className="text-neutral-900">JADEN Weekly Review</strong>
          </span>
          <span className="text-neutral-400">{r.sentAt}</span>
        </div>

        <article className="flex flex-col gap-6 rounded-3xl bg-surface p-7 shadow-lift">
          <Logo href="/dev/weekly-review-email" />
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-bold tracking-[0.08em] text-neutral-400 uppercase">
              Your week in review — {r.range}
            </p>
            <h1 className="font-serif text-[28px] leading-tight font-medium text-neutral-900">
              {r.headline}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-sage-100 p-4">
              <p className="font-serif text-[30px] font-extrabold text-sage-700">
                {r.daysJournaled}
              </p>
              <p className="text-[12px] text-neutral-600">days journaled</p>
            </div>
            <div className="rounded-2xl bg-amber-100 p-4">
              <p className="flex items-center gap-1.5 font-serif text-[30px] font-extrabold text-amber-700">
                {r.streak} <FlameIcon size={20} className="lv-flame text-amber-500" />
              </p>
              <p className="text-[12px] text-neutral-600">day streak</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4">
            <p className="text-[11px] font-bold tracking-[0.08em] text-neutral-400 uppercase">
              Entry of the week
            </p>
            <p className="font-serif text-[18px] font-semibold text-neutral-900">
              {r.entryOfTheWeek.title}
            </p>
            <p className="font-serif text-[15px] leading-relaxed text-neutral-600 italic">
              &ldquo;{r.entryOfTheWeek.quote}&rdquo;
            </p>
          </div>

          <div className="relative mt-20">
            <JadenPerch width={PLACEMENTS.weeklyReview.size} position={{ right: 10 }}>
              <JadenFor placement="weeklyReview" />
            </JadenPerch>
            <Link
              href="/insights"
              className="lv-cta flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold"
            >
              Open your full review in JADEN
            </Link>
          </div>
          <p className="text-center text-[11px] text-neutral-400">
            This summary was generated from your entries.
          </p>
        </article>
      </div>
    </main>
  )
}
