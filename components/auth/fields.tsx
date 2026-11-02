'use client'

import { useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from 'cn'

export const authInputClass =
  'h-[52px] w-full rounded-[14px] border-[1.5px] border-neutral-200 bg-surface px-4 text-[15px] font-medium text-neutral-900 outline-none transition-colors placeholder:font-normal placeholder:text-neutral-400 focus:border-neutral-900 disabled:opacity-60 aria-invalid:border-destructive'

export function Field({
  id,
  label,
  aside,
  error,
  children,
  className,
}: {
  id: string
  label: string
  aside?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-neutral-600">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Password input with a show/hide eye toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(authInputClass, 'pr-12', !visible && 'tracking-[0.12em]', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-4 flex items-center text-neutral-400 transition-colors hover:text-neutral-900"
      >
        {visible ? (
          <EyeOff className="size-[18px]" strokeWidth={1.8} />
        ) : (
          <Eye className="size-[18px]" strokeWidth={1.8} />
        )}
      </button>
    </div>
  )
}

export function getPasswordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[0-9]/.test(pw)) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColor = ['', 'bg-rose-500', 'bg-amber-500', 'bg-sage-500', 'bg-sage-500']

/** 4-segment strength meter + hint line. */
export function PasswordStrength({ password, invalid }: { password: string; invalid?: boolean }) {
  const strength = getPasswordStrength(password)
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-[2px] transition-colors duration-300',
              i <= strength ? strengthColor[strength] : 'bg-neutral-200',
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'text-[12px] leading-snug font-medium',
          invalid ? 'text-destructive' : 'text-neutral-600',
        )}
      >
        {strength > 0 && `${strengthLabel[strength]} — `}at least 8 characters, including a number.
      </p>
    </div>
  )
}
