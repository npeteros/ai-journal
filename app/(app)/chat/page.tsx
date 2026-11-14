import type { Metadata } from 'next'
import Link from 'next/link'

import { Page } from '@/components/app-shell/page'
import { JournalChat } from '@/components/chat/journal-chat'
import { auth } from '@/src/server/auth/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Chat' }

export default async function ChatPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <Page tone="mist" className="items-center gap-0 pb-0 lg:pt-10 lg:pb-0">
      <div className="flex w-full max-w-[760px] flex-1 flex-col">
        <header className="pb-4">
          <h1 className="font-serif text-[26px] leading-none font-semibold text-neutral-900 lg:text-[30px]">
            Chat with your journal
          </h1>
          <p className="mt-2 text-[13px] leading-normal text-neutral-400">
            Answers are grounded in your own entries. See your{' '}
            <Link
              href="/settings/data-privacy"
              className="font-semibold text-cloud-700 hover:underline"
            >
              Processing Log
            </Link>{' '}
            anytime.
          </p>
        </header>
        <JournalChat />
      </div>
    </Page>
  )
}
