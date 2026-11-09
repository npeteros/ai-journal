'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Popover } from 'radix-ui'
import { LogOut } from 'lucide-react'

import { SettingsIcon } from '@/components/brand/icons'
import { Button } from '@/components/ui/button'
import { UserAvatar, type ShellUser } from './user-avatar'
import { useSignOut } from './use-sign-out'

/** Mobile avatar button that opens a sheet with who's signed in, Settings and Sign out. */
export function AccountMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false)
  const { signOut, pending, error } = useSignOut()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Account"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="lv-card z-40 flex w-[min(320px,calc(100vw-32px))] flex-col gap-1 rounded-[18px] p-2"
        >
          <div className="flex items-center gap-3 px-2 pt-2 pb-3">
            <UserAvatar user={user} />
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="truncate text-[14px] font-semibold text-neutral-900">{user.name}</p>
              )}
              <p className="truncate text-[12px] text-neutral-400">{user.email}</p>
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-neutral-900 hover:bg-neutral-100"
          >
            <SettingsIcon size={18} />
            Settings
          </Link>

          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={signOut}
            className="h-auto justify-start gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-neutral-900 [&_svg:not([class*='size-'])]:size-[18px]"
          >
            <LogOut />
            {pending ? 'Signing out…' : 'Sign out'}
          </Button>

          {error && (
            <p role="alert" className="px-3 pb-2 text-[12px] text-destructive">
              {error}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
