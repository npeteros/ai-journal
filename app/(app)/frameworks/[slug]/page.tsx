import { TRPCError } from '@trpc/server'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { Page } from '@/components/app-shell/page'
import { FrameworkRunner } from '@/components/frameworks/framework-runner'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

function errorCode(error: unknown) {
  if (error instanceof TRPCError) return error.code
  return (error as { data?: { code?: string } } | null)?.data?.code
}

/** One lookup per request, shared by `generateMetadata` and the page. */
const loadFramework = cache(async (slug: string) => {
  try {
    return await getQueryClient().fetchQuery(trpc.v1.framework.findOneBySlug.queryOptions({ slug }))
  } catch (error) {
    const code = errorCode(error)
    if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') notFound()
    if (code === 'UNAUTHORIZED') redirect('/login')
    throw error
  }
})

export async function generateMetadata(props: PageProps<'/frameworks/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const { title } = await loadFramework(slug)
  return { title }
}

export default async function FrameworkEntryPage(props: PageProps<'/frameworks/[slug]'>) {
  const { slug } = await props.params
  const framework = await loadFramework(slug)

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkRunner framework={framework} />
    </Page>
  )
}
