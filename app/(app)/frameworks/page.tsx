import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Page, PageHeader } from '@/components/app-shell/page'
import { FrameworkIcon, isFrameworkIconName } from '@/components/frameworks/framework-icon'
import { OwnFrameworkActions } from '@/components/frameworks/own-framework-actions'
import { Rise } from '@/components/motion'
import { Card, SectionLabel } from '@/components/ui/card'
import type { FrameworkDto } from '@/src/server/api/routers/v1/framework/core/queries/shared'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Frameworks' }

const grid = 'mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3'

function FrameworkCard({ framework: f, i }: { framework: FrameworkDto; i: number }) {
  return (
    <li className="relative">
      <Rise i={i} className="h-full">
        <Link
          href={`/frameworks/${f.slug}`}
          className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Card hover className="flex h-full min-h-[176px] flex-col gap-3.5">
            {isFrameworkIconName(f.icon) && <FrameworkIcon name={f.icon} />}
            <div className="flex flex-col gap-1">
              <h3 className="font-serif text-[17px] leading-[1.3] font-semibold text-neutral-900">
                {f.title}
              </h3>
              <p className="text-[13px] leading-normal text-neutral-600">{f.description}</p>
            </div>
            <div className="flex-1" />
            <span className="text-[12px] leading-none font-medium text-neutral-400">
              {f.minutes} min
            </span>
          </Card>
        </Link>
        {/* A sibling of the link, positioned over the card, so buttons are never nested in it. */}
        {f.isOwn && (
          <div className="absolute top-3 right-3">
            <OwnFrameworkActions id={f.id} slug={f.slug} title={f.title} />
          </div>
        )}
      </Rise>
    </li>
  )
}

export default async function FrameworksPage() {
  const frameworks = await getQueryClient().fetchQuery(trpc.v1.framework.findMany.queryOptions())
  const yours = frameworks.filter((f) => f.isOwn)
  const templates = frameworks.filter((f) => !f.isOwn)

  return (
    <Page tone="meadow">
      <PageHeader
        title="Frameworks"
        subtitle="Structured prompts for deeper reflection, whenever freeform writing needs a nudge."
      />

      <section aria-labelledby="frameworks-yours" className="mt-2">
        <SectionLabel id="frameworks-yours">Yours</SectionLabel>
        <ul className={grid}>
          {yours.map((f, i) => (
            <FrameworkCard key={f.id} framework={f} i={i} />
          ))}
          <li>
            <Rise i={yours.length} className="h-full">
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
      </section>

      {templates.length > 0 && (
        <section aria-labelledby="frameworks-templates" className="mt-8">
          <SectionLabel id="frameworks-templates">Templates</SectionLabel>
          <ul className={grid}>
            {templates.map((f, i) => (
              <FrameworkCard key={f.id} framework={f} i={yours.length + 1 + i} />
            ))}
          </ul>
        </section>
      )}
    </Page>
  )
}
