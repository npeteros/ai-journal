import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { VoiceSession } from '@/components/journal/voice-session'
import { firstNameOf } from '@/src/lib/format'
import { getServerSession } from '@/src/server/auth/session'

export const metadata: Metadata = { title: 'Voice session' }

/** Guided voice journaling with JADEN (GPT-Live), with a typing fallback. */
export default async function VoicePage() {
  // The (app) layout has already redirected when there is no session.
  const session = await getServerSession()
  const firstName = session ? firstNameOf(session.user.name) : null

  return (
    <Page className="items-center">
      <VoiceSession firstName={firstName} />
    </Page>
  )
}
