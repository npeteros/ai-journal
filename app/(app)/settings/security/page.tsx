import type { Metadata } from 'next'
import { Mail } from 'lucide-react'

import { ActiveSessions } from '@/components/settings/active-sessions'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { DeleteAccount } from '@/components/settings/delete-account'
import {
  RowIcon,
  SettingsRow,
  SettingsSection,
  SettingsTitle,
} from '@/components/settings/settings-ui'
import { getServerSession } from '@/src/server/auth/session'

export const metadata: Metadata = { title: 'Security' }

// Email + password only (passcode / passkey were dropped in favour of email/password auth).
export default async function SecuritySettingsPage() {
  const session = await getServerSession()

  return (
    <>
      <SettingsTitle>Security</SettingsTitle>
      <SettingsSection label="Sign-in" i={0}>
        <SettingsRow
          icon={
            <RowIcon tone="sage">
              <Mail className="size-[15px]" strokeWidth={2} />
            </RowIcon>
          }
          label="Email"
          value={session?.user.email}
        />
      </SettingsSection>
      <ChangePasswordForm />
      <ActiveSessions />
      <DeleteAccount />
    </>
  )
}
