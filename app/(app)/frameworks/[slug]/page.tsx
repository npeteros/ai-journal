import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Frameworks' }

export default async function FrameworksPage() {
  const frameworks = await getQueryClient().fetchQuery(trpc.v1.framework.findMany.queryOptions())

  return (
    <Page tone="mist" className="items-center gap-0 lg:pt-10">
      <div className="flex w-full max-w-[760px] flex-col">
        <header className="pb-5">
          <h1 className="font-serif text-[26px] leading-none font-semibold text-neutral-900 lg:text-[30px]">
            Frameworks
          </h1>
          <p className="mt-2 text-[13px] leading-normal text-neutral-400">
            Guided reflections. Finish one and it becomes a journal entry.
          </p>
        </header>

        {frameworks.length === 0 ? (
          <p className="text-[14px] text-neutral-400">No frameworks yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {/* ADAPT: swap this card for your existing gallery card component */}
            {frameworks.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/frameworks/${f.slug}`}
                  className="lv-card block rounded-[18px] p-5 transition-transform hover:-translate-y-px"
                >
                  <h2 className="font-serif text-[20px] leading-tight font-semibold text-neutral-900">
                    {f.title}
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-normal text-neutral-900">
                    {f.description}
                  </p>
                  <p className="mt-3 text-[12px] font-medium text-neutral-400">
                    {f.minutes} min · {f.prompts.length} prompts
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  )
}
