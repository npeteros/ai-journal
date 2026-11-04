import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { BubbleIn } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { GlintText, Orb } from '@/components/ui/ai'
import { formatEntryDateTime } from '@/src/lib/format'
import { companionPrompt, placeholderEntries } from '@/src/lib/placeholder/entries'

export const metadata: Metadata = { title: 'JADEN companion' }

// Placeholder: the companion question will come from the AI layer while you write.
export default function CompanionPage() {
  const entry = placeholderEntries[0]

  return (
    <Page tone="mist" className="items-center">
      <div className="flex w-full max-w-[660px] flex-1 flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <Link
            href="/journal"
            className="text-[15px] font-medium text-neutral-400 hover:text-neutral-600"
          >
            Cancel
          </Link>
          <Button asChild variant="ink-flat" size="md" className="px-[22px] text-[14px]">
            <Link href={`/journal/${entry.id}`}>Done</Link>
          </Button>
        </div>
        <p className="mt-3 text-[12px] font-semibold tracking-[0.05em] text-neutral-400 uppercase">
          {formatEntryDateTime(entry.writtenAt)}
        </p>
        <h1 className="font-serif text-[22px] leading-[1.3] font-medium text-neutral-900 lg:text-[30px]">
          {entry.title}
        </h1>
        <p className="text-[15px] leading-[1.7] text-neutral-900 lg:text-[17px] lg:leading-[1.8]">
          {entry.body}
        </p>

        <div className="flex-1" />

        <BubbleIn from="left" i={2} className="relative mt-24">
          <JadenPerch width={PLACEMENTS.companion.size} position={{ right: 14 }}>
            <JadenFor placement="companion" />
          </JadenPerch>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-cloud-200 bg-surface p-4 shadow-lift">
            <span className="flex items-center gap-2">
              <Orb size={18} className="m-0.5" />
              <GlintText className="text-[12px] font-bold">JADEN companion</GlintText>
            </span>
            <p className="font-serif text-[15px] leading-normal font-medium text-neutral-900 lg:text-[17px]">
              {companionPrompt}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/journal/${entry.id}`}
                className="rounded-full border border-neutral-200 px-3.5 py-[7px] text-[12px] leading-none font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Add to entry
              </Link>
              <Link
                href="/journal"
                className="rounded-full border border-neutral-200 px-3.5 py-[7px] text-[12px] leading-none font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Not now
              </Link>
            </div>
          </div>
        </BubbleIn>
      </div>
    </Page>
  )
}
