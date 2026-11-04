import type { ReactNode } from 'react'

import { SettingsNav } from '@/components/settings/settings-nav'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="lv-paper lv-paper-fixed flex min-h-full flex-1 flex-col gap-6 px-5 pt-8 pb-10 sm:px-8 lg:flex-row lg:gap-0 lg:p-0">
      <SettingsNav />
      <div className="flex w-full max-w-[760px] flex-col gap-7 lg:px-16 lg:py-12">{children}</div>
    </main>
  )
}
