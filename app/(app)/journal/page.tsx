import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { JadenFor, JadenPerch, PLACEMENTS } from '@/components/jaden'
import { EntryList } from '@/components/journal/entry-list'
import { TodayBand } from '@/components/journal/today-band'
import { Rise } from '@/components/motion'
import { formatTodayOverline, greetingFor } from '@/src/lib/format'
import { todaysPrompt, weekMoods } from '@/src/lib/placeholder/entries'
import { placeholderUser } from '@/src/lib/placeholder/user'
import { PAGE_SIZE_DEFAULT } from '@/src/server/api/routers/v1/entry/schema'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Journal' }

export default async function JournalHomePage() {
  const jaden = PLACEMENTS.journalHome

  // Prefetch the first page of entries and the tag chips so the list renders without a loading
  // flash. Prefetch swallows errors, so a failure here surfaces as the list's error state instead.
  const queryClient = getQueryClient()
  await Promise.all([
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
            {greetingFor()}, <em className="text-amber-700 italic">{placeholderUser.name}.</em>
          </h1>
        </Rise>
      </header>

      {/* Jaden sits on top of the today band (the band clips, so he perches on a sibling above it) */}
      {/* On phones the greeting fills the row, so leave room above the band for Jaden */}
      <Rise i={1} className="mt-[120px] flex flex-col md:mt-10">
        <div className="relative z-[3] h-0">
          <JadenPerch width={jaden.size} className="right-3 md:right-6">
            <JadenFor placement="journalHome" vars={{ name: placeholderUser.name }} />
          </JadenPerch>
        </div>
        <TodayBand
          prompt={todaysPrompt.text}
          source={todaysPrompt.source}
          week={weekMoods}
          writeHref="/journal/new"
        />
      </Rise>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <EntryList />
      </HydrationBoundary>
    </Page>
  )
}
