import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { FrameworkBuilder } from '@/components/frameworks/framework-builder'
import { isFrameworkIconName } from '@/components/frameworks/framework-icon'
import { getQueryClient, trpc } from '@/src/server/trpc/server'

export const metadata: Metadata = { title: 'New framework' }

export default async function FrameworkBuilderPage(props: PageProps<'/frameworks'>) {
  const { from } = await props.searchParams
  const source =
    typeof from === 'string'
      ? await getQueryClient()
          .fetchQuery(trpc.v1.framework.findOneBySlug.queryOptions({ slug: from }))
          .catch(() => null)
      : null

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkBuilder
        initial={{
          title: source?.title ?? '',
          description: source?.description ?? '',
          icon: source && isFrameworkIconName(source.icon) ? source.icon : 'layers',
          prompts: source?.prompts.map((p) => p.prompt) ?? [],
        }}
      />
    </Page>
  )
}
