import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { EntryList } from '@/components/journal/entry-list'
import { TodayBand } from '@/components/journal/today-band'
import { Rise } from '@/components/motion'
import { firstNameOf, formatTodayOverline, greetingFor } from '@/src/lib/format'
import { todaysPrompt } from '@/src/lib/placeholder/entries'
import { PAGE_SIZE_DEFAULT } from '@/src/server/api/routers/v1/entry/schema'
import { getServerSession } from '@/src/server/auth/session'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Journal' }

export default async function JournalHomePage() {
  const jaden = PLACEMENTS.journalHome
  // The (app) layout has already redirected when there is no session.
  const session = await getServerSession()
  const firstName = session ? firstNameOf(session.user.name) : null

  // Start the first page of entries and the tag chips without waiting for them: the pending queries
  // are dehydrated and stream to the list, so the greeting and today band render right away.
  // Prefetch swallows errors, so a failure here surfaces as the list's error state instead.
  const queryClient = getQueryClient()
  void Promise.all([
    queryClient.prefetchInfiniteQuery({
      // Must match the key in components/journal/entry-list.tsx
      queryKey: [
        ...trpc.v1.entry.findMany.pathKey(),
        'journal-home',
        { searchText: undefined, tagId: undefined },
      ],
      initialPageParam: 0,
      queryFn: ({ pageParam }) =>
        queryClient.fetchQuery(
          trpc.v1.entry.findMany.queryOptions({ skip: pageParam, take: PAGE_SIZE_DEFAULT }),
        ),
    }),
    queryClient.prefetchQuery(trpc.v1.tag.findMany.queryOptions()),
  ])

  return (
    <Page>
      <header>
        <Rise className="flex flex-col gap-2.5">
          <p className="text-[12px] leading-none font-bold tracking-[0.09em] text-amber-700 uppercase">
            {formatTodayOverline()}
          </p>
          <h1 className="font-serif text-[32px] leading-[1.05] font-medium tracking-[-0.01em] text-neutral-900 lg:text-[40px]">
            {firstName ? (
              <>
                {greetingFor()}, <em className="text-amber-700 italic">{firstName}.</em>
              </>
            ) : (
              `${greetingFor()}.`
            )}
          </h1>
        </Rise>
      </header>

      {/* Jaden sits on top of the today band (the band clips, so he perches on a sibling above it) */}
      {/* On phones the greeting fills the row, so leave room above the band for Jaden */}
      <Rise i={1} className="mt-[120px] flex flex-col md:mt-10">
        <div className="relative z-[3] h-0">
          <JadenPerch width={jaden.size} className="right-3 md:right-6">
            <JadenFor placement="journalHome" vars={{ name: firstName ?? 'there' }} />
          </JadenPerch>
        </div>
        <TodayBand
          prompt={todaysPrompt.text}
          source={todaysPrompt.source}
          writeHref="/journal/new"
        />
      </Rise>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <EntryList />
      </HydrationBoundary>
    </Page>
  )
}
