import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Page } from '@/components/app-shell/page'
import { FrameworkBuilder } from '@/components/frameworks/framework-builder'
import { isFrameworkIconName } from '@/components/frameworks/framework-icon'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'Edit framework' }

export default async function FrameworkEditPage(props: PageProps<'/frameworks/[slug]'>) {
  const { slug } = await props.params
  const framework = await getQueryClient()
    .fetchQuery(trpc.v1.framework.findOneBySlug.queryOptions({ slug }))
    .catch(() => null)
  if (!framework) notFound()

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkBuilder
        frameworkId={framework.id}
        initial={{
          title: framework.title,
          description: framework.description,
          icon: isFrameworkIconName(framework.icon) ? framework.icon : 'layers',
          prompts: framework.prompts.map((p) => p.prompt),
        }}
      />
    </Page>
  )
}
