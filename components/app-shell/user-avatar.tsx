import { cn } from 'cn'

export type ShellUser = { name: string; email: string }

export function initialsFor({ name, email }: ShellUser) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return (email[0] ?? '?').toUpperCase()
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

/** Initials in a circle; decorative, so callers label the surrounding control. */
export function UserAvatar({ user, className }: { user: ShellUser; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-bold text-amber-700',
        className,
      )}
    >
      {initialsFor(user)}
    </span>
  )
}
