'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'

import { Field, PasswordInput, authInputClass } from '@/components/auth/fields'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { signOut } from '@/src/lib/auth-client'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  DELETE_CONFIRMATION,
  deleteAccountSchema,
  type DeleteAccountInput,
  type DeleteAccountValues,
} from '@/src/server/auth/schemas/delete-account'
import { useTRPC } from '@/src/server/trpc/client'

/**
 * Soft-deletes the account (see `v1.account.delete`). Needs the current password and the word
 * DELETE. On success every session is already gone server-side; this clears the browser's
 * cookies and caches and returns to the landing page.
 */
export function DeleteAccount() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const deleteAccount = useMutation(trpc.v1.account.delete.mutationOptions())

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput, unknown, DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirmation: '' },
  })

  async function onSubmit(values: DeleteAccountValues) {
    try {
      await deleteAccount.mutateAsync(values)
    } catch (error) {
      const code = (error as { data?: { code?: string } }).data?.code
      if (code === 'FORBIDDEN') return setError('password', { message: 'Incorrect password.' })
      return setError('root', {
        message: (error as Error).message || 'Something went wrong. Please try again.',
      })
    }

    try {
      await signOut()
    } catch {
      // The sessions are already deleted server-side; the cookies are harmless without them.
    }
    queryClient.clear()
    // A full navigation also drops the router cache of signed-in pages.
    window.location.assign('/')
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
        Delete account
      </h2>
      <Rise i={3}>
        <div className="flex max-w-[460px] flex-col gap-4 rounded-[14px] border border-amber-500 p-5">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 size-[19px] shrink-0 text-amber-700" strokeWidth={2} />
            <div className="flex flex-col gap-1.5 text-[13px] leading-normal text-neutral-600">
              <p>
                Deleting your account signs you out everywhere and stops anyone, including you, from
                signing in. Your entries, tags, insights and chats are kept for{' '}
                {ACCOUNT_DELETION_GRACE_DAYS} days, then permanently removed.
              </p>
              <p>
                <Link
                  href="/settings/data-privacy"
                  className="font-semibold text-cloud-700 hover:underline"
                >
                  Export your journal first
                </Link>
                , if you want a copy.
              </p>
            </div>
          </div>

          {!open ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setOpen(true)}
              className="h-[38px] self-start rounded-[10px] px-[18px] text-[13px]"
            >
              Delete my account…
            </Button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
              <Field id="delete-password" label="Current password" error={errors.password?.message}>
                <PasswordInput
                  id="delete-password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'delete-password-error' : undefined}
                  disabled={isSubmitting}
                  {...register('password')}
                />
              </Field>

              <Field
                id="delete-confirmation"
                label={`Type ${DELETE_CONFIRMATION} to confirm`}
                error={errors.confirmation?.message}
              >
                <input
                  id="delete-confirmation"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={DELETE_CONFIRMATION}
                  aria-invalid={!!errors.confirmation}
                  aria-describedby={errors.confirmation ? 'delete-confirmation-error' : undefined}
                  disabled={isSubmitting}
                  className={authInputClass}
                  {...register('confirmation')}
                />
              </Field>

              {errors.root && (
                <p role="alert" className="text-[13px] text-destructive">
                  {errors.root.message}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  variant="danger"
                  disabled={isSubmitting}
                  className="h-[38px] rounded-[10px] px-[18px] text-[13px]"
                >
                  {isSubmitting ? 'Deleting…' : 'Delete my account'}
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                  className="text-[13px] font-medium text-neutral-400 hover:text-neutral-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </Rise>
    </section>
  )
}
