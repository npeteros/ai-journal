'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'

import { useTRPC } from '@/src/server/trpc/client'
import { getFrameworkErrorMessage } from './framework-error'

const iconButton =
  'flex size-8 items-center justify-center rounded-lg text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Edit and delete for one of the user's own gallery cards. Sits on top of the card's link (not
 * inside it), and asks for confirmation in place before deleting.
 */
export function OwnFrameworkActions({
  id,
  slug,
  title,
}: {
  id: string
  slug: string
  title: string
}) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation(
    trpc.v1.framework.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.v1.framework.pathFilter())
        router.refresh()
      },
    }),
  )

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1.5 shadow-sm">
          <span className="text-[13px] font-semibold text-neutral-900">Delete?</span>
          <button
            type="button"
            onClick={() => remove.mutate({ id })}
            disabled={remove.isPending}
            className="rounded-lg px-2 py-1 text-[13px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false)
              remove.reset()
            }}
            disabled={remove.isPending}
            className="rounded-lg px-2 py-1 text-[13px] font-semibold text-neutral-400 hover:text-neutral-900"
          >
            Cancel
          </button>
        </div>
        {remove.error && (
          <p role="alert" className="max-w-[220px] text-right text-[12px] text-rose-500">
            {getFrameworkErrorMessage(remove.error)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Link href={`/frameworks/${slug}/edit`} aria-label={`Edit "${title}"`} className={iconButton}>
        <Pencil className="size-4" strokeWidth={2} />
      </Link>
      <button
        type="button"
        aria-label={`Delete "${title}"`}
        onClick={() => setConfirming(true)}
        className={iconButton}
      >
        <Trash2 className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}
