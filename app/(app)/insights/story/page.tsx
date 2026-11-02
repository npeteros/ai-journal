import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { InsightsHeader } from '@/components/insights/insights-header'
import { StoryView } from '@/components/insights/story-view'
import { storyMonths, storyQuote } from '@/src/lib/placeholder/insights'

export const metadata: Metadata = { title: 'Story' }

export default function StoryPage() {
  return (
    <Page tone="dusk">
      <InsightsHeader />
      <StoryView months={storyMonths} quote={storyQuote} />
    </Page>
  )
}
