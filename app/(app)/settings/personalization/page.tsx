import type { Metadata } from 'next'

import { AboutYouSettings } from '@/components/settings/about-you-settings'
import { SettingsTitle } from '@/components/settings/settings-ui'

export const metadata: Metadata = { title: 'About you' }

export default function AboutYouSettingsPage() {
  return (
    <>
      <SettingsTitle>About you</SettingsTitle>
      <p className="-mt-3 text-[14px] leading-snug text-neutral-600">
        Jaden uses these answers as background when you chat and when it writes your insights.
        They’re never used to train AI models.
      </p>
      <AboutYouSettings />
    </>
  )
}
