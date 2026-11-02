import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { VoiceSession } from '@/components/journal/voice-session'
import { voiceSession } from '@/src/lib/placeholder/entries'

export const metadata: Metadata = { title: 'Voice session' }

// Placeholder: guided voice journaling with JADEN. The scripted conversation stands in for a
// realtime AI voice model until one is integrated.
export default function VoicePage() {
  return (
    <Page className="items-center">
      <VoiceSession turns={voiceSession.turns} draft={voiceSession.draft} />
    </Page>
  )
}
