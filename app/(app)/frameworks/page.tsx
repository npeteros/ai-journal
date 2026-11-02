import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Page, PageHeader } from '@/components/app-shell/page'
import { FrameworkIcon } from '@/components/frameworks/framework-icon'
import { Rise } from '@/components/motion'
import { Card } from '@/components/ui/card'
import { placeholderFrameworks } from '@/src/lib/placeholder/frameworks'

export const metadata: Metadata = { title: 'Frameworks' }

export default function FrameworksPage() {
  return (
    <Page tone="meadow">
      <PageHeader
        title="Frameworks"
        subtitle="Structured prompts for deeper reflection, whenever freeform writing needs a nudge."
      />

      <ul className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        {placeholderFrameworks.map((f, i) => (
          <li key={f.slug}>
            <Rise i={i} className="h-full">
              <Link
                href={`/frameworks/${f.slug}`}
                className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Card hover className="flex h-full min-h-[176px] flex-col gap-3.5">
                  <FrameworkIcon name={f.icon} />
                  <div className="flex flex-col gap-1">
                    <h2 className="font-serif text-[17px] leading-[1.3] font-semibold text-neutral-900">
                      {f.title}
                    </h2>
                    <p className="text-[13px] leading-normal text-neutral-600">{f.description}</p>
                  </div>
                  <div className="flex-1" />
                  <span className="text-[12px] leading-none font-medium text-neutral-400">
                    {f.minutes} min
                  </span>
                </Card>
              </Link>
            </Rise>
          </li>
        ))}
        <li>
          <Rise i={placeholderFrameworks.length} className="h-full">
            <Link
              href="/frameworks/builder"
              className="flex h-full min-h-[176px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-sage-200 p-[22px] text-sage-700 transition-colors outline-none hover:bg-sage-100/60 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Plus className="size-6" strokeWidth={2} />
              <span className="text-[14px] leading-[1.3] font-semibold">
                Build your own framework
              </span>
            </Link>
          </Rise>
        </li>
      </ul>
    </Page>
  )
}
