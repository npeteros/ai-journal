import type { Metadata } from 'next'

import { LanguagePicker } from '@/components/settings/language-picker'
import { SettingsTitle } from '@/components/settings/settings-ui'

export const metadata: Metadata = { title: 'Language' }

export default function LanguageSettingsPage() {
  return (
    <>
      <SettingsTitle>Language</SettingsTitle>
      <LanguagePicker />
      <p className="text-[13px] leading-normal text-neutral-400">
        AI features are tuned for English right now and may be less accurate in other languages.
        Writing and local storage work the same everywhere.
      </p>
    </>
  )
}
