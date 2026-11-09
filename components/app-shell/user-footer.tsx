'use client'

import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UserAvatar, type ShellUser } from './user-avatar'
import { useSignOut } from './use-sign-out'

/** Desktop sidebar footer: who's signed in, plus a sign-out button. */
export function UserFooter({ user }: { user: ShellUser }) {
  const { signOut, pending, error } = useSignOut()

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          {user.name && (
            <p className="truncate text-[14px] font-semibold text-neutral-900">{user.name}</p>
          )}
          <p className="truncate text-[12px] text-neutral-400">{user.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
          disabled={pending}
          onClick={signOut}
          className="text-neutral-400 hover:text-neutral-900"
        >
          <LogOut />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
