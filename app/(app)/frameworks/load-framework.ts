import { TRPCError } from '@trpc/server'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { getQueryClient, trpc } from '@/src/server/trpc/server'

function errorCode(error: unknown) {
  if (error instanceof TRPCError) return error.code
  return (error as { data?: { code?: string } } | null)?.data?.code
}

/**
 * Looks a framework up by slug. Missing or malformed slugs give `null`, an expired session goes
 * to /login, and anything else is rethrown so it reaches the error boundary.
 */
export const findFramework = cache(async (slug: string) => {
  try {
    return await getQueryClient().fetchQuery(trpc.v1.framework.findOneBySlug.queryOptions({ slug }))
  } catch (error) {
    const code = errorCode(error)
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') return null
    if (code === 'UNAUTHORIZED') redirect('/login')
    throw error
  }
})

/** Like `findFramework`, but a missing framework renders the not-found page. */
export async function loadFramework(slug: string) {
  return (await findFramework(slug)) ?? notFound()
}
