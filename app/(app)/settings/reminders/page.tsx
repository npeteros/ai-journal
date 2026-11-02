import type { Metadata } from 'next'

import { ReminderRows } from '@/components/settings/reminder-rows'
import { SettingsSection, SettingsTitle } from '@/components/settings/settings-ui'
import { reminderSettings } from '@/src/lib/placeholder/settings'

export const metadata: Metadata = { title: 'Reminders' }

export default function RemindersSettingsPage() {
  return (
    <>
      <SettingsTitle>Reminders</SettingsTitle>
      <SettingsSection label="Daily reminder" i={0}>
        <ReminderRows initial={reminderSettings} />
      </SettingsSection>
      <p className="text-[13px] leading-normal text-neutral-400">
        A gentle nudge to write, once a day. You can always write without one.
      </p>
    </>
  )
}
