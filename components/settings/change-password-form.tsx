'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { Field, PasswordInput, PasswordStrength } from '@/components/auth/fields'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { changePassword } from '@/src/lib/auth-client'
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from '@/src/server/auth/schemas/change-password'
import { SESSIONS_QUERY_KEY } from './active-sessions'

/** Current password + new password (same rules as registration), via Better Auth. */
export function ChangePasswordForm() {
  const queryClient = useQueryClient()
  const [changed, setChanged] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '', revokeOtherSessions: true },
  })
  const newPassword = useWatch({ control, name: 'newPassword' })

  async function onSubmit({
    currentPassword,
    newPassword,
    revokeOtherSessions,
  }: ChangePasswordValues) {
    setChanged(false)
    const { error } = await changePassword({ currentPassword, newPassword, revokeOtherSessions })

    if (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return setError('currentPassword', { message: 'Current password is incorrect.' })
      }
      return setError('root', {
        message: error.message || 'Something went wrong. Please try again.',
      })
    }

    reset()
    setChanged(true)
    // Other sessions may just have been signed out.
    void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
        Change password
      </h2>
      <Rise i={1}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="lv-card flex max-w-[460px] flex-col gap-3.5 rounded-[14px] p-5"
        >
          <Field
            id="current-password"
            label="Current password"
            error={errors.currentPassword?.message}
          >
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              aria-describedby={errors.currentPassword ? 'current-password-error' : undefined}
              disabled={isSubmitting}
              {...register('currentPassword')}
            />
          </Field>

          <Field id="new-password" label="New password" error={errors.newPassword?.message}>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              disabled={isSubmitting}
              {...register('newPassword')}
            />
            <PasswordStrength password={newPassword} invalid={!!errors.newPassword} />
          </Field>

          <Field id="confirm-password" label="Confirm new password" error={errors.confirm?.message}>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
              disabled={isSubmitting}
              {...register('confirm')}
            />
          </Field>

          <label className="mt-1 flex items-start gap-2.5 text-[13px] leading-[1.45] text-neutral-600">
            <span className="relative mt-px flex size-[18px] shrink-0">
              <input
                type="checkbox"
                className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-neutral-300 bg-surface transition-colors checked:border-neutral-900 checked:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-ring/50"
                {...register('revokeOtherSessions')}
              />
              <Check
                className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-surface peer-checked:block"
                strokeWidth={3}
              />
            </span>
            <span>Sign out of all other devices</span>
          </label>

          {errors.root && (
            <p role="alert" className="text-[13px] text-destructive">
              {errors.root.message}
            </p>
          )}
          {changed && (
            <output className="text-[13px] font-medium text-sage-700">
              Password changed. Use your new password next time you sign in.
            </output>
          )}

          <Button
            type="submit"
            variant="ink-flat"
            disabled={isSubmitting}
            className="h-[42px] self-start rounded-[11px] px-5 text-[14px]"
          >
            {isSubmitting ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </Rise>
    </section>
  )
}
