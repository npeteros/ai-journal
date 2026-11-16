import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TRPCError } from '@trpc/server'

import { Page } from '@/components/app-shell/page'
import { FrameworkRunner } from '@/components/frameworks/framework-runner'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

type Props = { params: Promise<{ slug: string }> }

function isNotFound(e: unknown) {
  if (e instanceof TRPCError) return e.code === 'NOT_FOUND'
  return (e as { data?: { code?: string } } | null)?.data?.code === 'NOT_FOUND'
}

async function getFramework(slug: string) {
  try {
    return await getQueryClient().fetchQuery(trpc.v1.framework.findOneBySlug.queryOptions({ slug }))
  } catch (e) {
    if (isNotFound(e)) return null
    throw e
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const framework = await getFramework((await params).slug)
  return { title: framework?.title ?? 'Framework' }
}

export default async function FrameworkPage({ params }: Props) {
  const framework = await getFramework((await params).slug)
  if (!framework) notFound() // unknown slug shows not-found

  return (
    <Page tone="mist" className="items-center gap-0 lg:pt-10">
      <div className="flex w-full max-w-[760px] flex-1 flex-col">
        <FrameworkRunner framework={framework} />
      </div>
    </Page>
  )
}
