import type { Metadata } from 'next'
import { Globe, Mail, SunMedium } from 'lucide-react'

import { ReminderRows } from '@/components/settings/reminder-rows'
import {
  RowIcon,
  SettingsRow,
  SettingsSection,
  SettingsTitle,
} from '@/components/settings/settings-ui'
import { ThemeToggle } from '@/components/settings/theme-toggle'
import { languages, reminderSettings } from '@/src/lib/placeholder/settings'
import { placeholderUser } from '@/src/lib/placeholder/user'

export const metadata: Metadata = { title: 'Settings' }

export default function GeneralSettingsPage() {
  return (
    <>
      <SettingsTitle>General</SettingsTitle>

      <SettingsSection label="Appearance" i={0}>
        <SettingsRow
          icon={
            <RowIcon>
              <SunMedium className="size-[18px]" strokeWidth={2} />
            </RowIcon>
          }
          label="Theme"
          value={<ThemeToggle />}
        />
        <SettingsRow
          icon={
            <RowIcon>
              <Globe className="size-[18px]" strokeWidth={2} />
            </RowIcon>
          }
          label="Language"
          value={languages[0].label}
          href="/settings/language"
        />
      </SettingsSection>

      <SettingsSection label="Security" i={1}>
        <SettingsRow
          icon={
            <RowIcon tone="sage">
              <Mail className="size-[15px]" strokeWidth={2} />
            </RowIcon>
          }
          label="Email"
          value={placeholderUser.email}
        />
        <SettingsRow inset label="Change password" href="/settings/security" />
      </SettingsSection>

      <SettingsSection label="Reminders" i={2}>
        <ReminderRows initial={reminderSettings} />
      </SettingsSection>

      <p className="mt-1 text-center text-[12px] leading-snug text-neutral-400">
        JADEN never trains AI models on your data.
      </p>
    </>
  )
}
