import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Check, Cloud } from 'lucide-react'

import { Logo } from '@/components/brand/logo'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { EntryCard } from '@/components/journal/entry-card'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { MoodDot } from '@/components/ui/chip'
import { placeholderEntries } from '@/src/lib/placeholder/entries'

export const metadata: Metadata = { title: { absolute: 'JADEN — Reflect deeper, every day' } }

const previewEntry = {
  ...placeholderEntries[0],
  body: 'Woke up before the alarm and just sat with my coffee for a while, no phone, no rush.',
}

function TrustRow({
  tone,
  label,
  children,
}: {
  tone: 'cloud' | 'sage'
  label: string
  children: string
}) {
  const styles =
    tone === 'cloud'
      ? 'border-cloud-200 bg-cloud-100 text-cloud-700'
      : 'border-sage-200 bg-sage-100 text-sage-700'
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3.5">
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pr-3 pl-2.5 text-[12px] font-semibold ${styles}`}
      >
        <Check className="size-3.5" strokeWidth={2} />
        {label}
      </span>
      <p className="text-[14px] leading-normal text-neutral-600 sm:pt-[5px]">{children}</p>
    </div>
  )
}

function float(i: number, r: string): CSSProperties {
  return { '--i': i, '--r': r } as CSSProperties
}

export default function OnboardingPage() {
  return (
    <div className="lv-paper flex min-h-dvh flex-col bg-bg lg:flex-row">
      {/* Copy */}
      <main className="flex flex-1 flex-col justify-center gap-8 px-6 pt-10 pb-6 sm:px-12 lg:px-20 lg:py-14 [&>*]:max-w-[560px]">
        <Rise>
          <Logo />
        </Rise>
        <Rise i={1} className="flex flex-col gap-4">
          <h1 className="font-serif text-[40px] leading-[1.15] font-medium text-neutral-900 lg:text-[52px]">
            Reflect deeper, every day.
          </h1>
          <p className="max-w-[480px] text-[16px] leading-[1.65] text-neutral-600 lg:text-[17px]">
            JADEN pairs a calm daily journal with frontier AI — richer reflection, pattern
            detection, and insight than a simple notes app.
          </p>
        </Rise>
        <Rise i={2} className="mt-1 flex flex-col gap-3.5">
          <TrustRow tone="cloud" label="Always disclosed">
            Every AI request is logged in your Processing Log, and never used to train models.
          </TrustRow>
          <TrustRow tone="sage" label="Always exportable">
            One-tap export of every entry and insight, any time.
          </TrustRow>
        </Rise>
        <Rise i={3} className="mt-3 flex items-center gap-5">
          <Button asChild variant="ink" size="cta-lg" className="px-[30px] shadow-lift">
            <Link href="/register">Get started free</Link>
          </Button>
          <Link
            href="/login"
            className="text-[14px] font-semibold text-neutral-900 hover:underline"
          >
            Sign in
          </Link>
        </Rise>
      </main>

      {/* Product preview */}
      <aside
        aria-hidden
        className="relative min-h-[520px] w-full shrink-0 overflow-hidden bg-[linear-gradient(160deg,var(--sage-100),var(--cloud-100))] lg:min-h-0 lg:w-[46%] xl:w-[600px]"
      >
        <div
          className="lv-float absolute -top-[100px] -left-[90px] size-[340px] rounded-full bg-sage-200 opacity-70 blur-[8px]"
          style={float(0, '0deg')}
        />
        <div
          className="lv-float absolute -right-[70px] -bottom-[80px] size-[300px] rounded-full bg-cloud-200 opacity-75 blur-[8px]"
          style={float(2, '0deg')}
        />

        <div
          className="lv-float absolute top-[110px] left-6 w-[min(340px,calc(100%-48px))] sm:left-[60px] lg:top-[120px]"
          style={float(0, '-2deg')}
        >
          <EntryCard entry={previewEntry} spine={false} className="shadow-lift">
            <JadenPerch width={PLACEMENTS.onboarding.size} position={{ right: 16 }}>
              <JadenFor placement="onboarding" petable={false} />
            </JadenPerch>
          </EntryCard>
        </div>

        <div
          className="lv-card lv-float absolute top-[330px] right-6 flex w-[min(300px,calc(100%-48px))] flex-col gap-2.5 rounded-2xl p-5 shadow-lift sm:right-[70px] lg:top-[340px]"
          style={float(1, '2.5deg')}
        >
          <p className="text-[13px] font-semibold text-neutral-900">Mood mix, this week</p>
          <div className="flex flex-wrap gap-2">
            {(['calm', 'grateful'] as const).map((m) => (
              <span key={m} className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5">
                <MoodDot mood={m} size={7} />
                <span className="text-[12px] font-semibold text-neutral-600 capitalize">{m}</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="lv-card lv-float absolute bottom-[60px] left-6 flex w-[220px] items-center gap-3 rounded-2xl p-4 shadow-lift sm:left-[120px] lg:bottom-[90px]"
          style={float(2, '-1.5deg')}
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-surface">
            <Cloud className="size-[15px]" strokeWidth={2.2} />
          </span>
          <span className="text-[13px] leading-[1.4] font-medium text-neutral-900">
            Deadline pressure keeps coming up on Mondays.
          </span>
        </div>
      </aside>
    </div>
  )
}
