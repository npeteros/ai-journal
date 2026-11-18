import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { FrameworkBuilder } from '@/components/frameworks/framework-builder'
import { isFrameworkIconName } from '@/components/frameworks/framework-icon'
import { findFramework } from '../load-framework'

export const metadata: Metadata = { title: 'New framework' }

export default async function FrameworkBuilderPage(props: PageProps<'/frameworks/builder'>) {
  const { from } = await props.searchParams
  // `?from=<slug>` starts from an existing framework; an unknown slug just opens a blank builder.
  const source = typeof from === 'string' ? await findFramework(from) : null

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkBuilder
        initial={{
          title: source?.title ?? '',
          description: source?.description ?? '',
          icon: source && isFrameworkIconName(source.icon) ? source.icon : 'layers',
          prompts: source?.prompts ?? [],
        }}
      />
    </Page>
  )
}
