import type { Metadata } from 'next'

import { Page } from '@/components/app-shell/page'
import { FrameworkRunner } from '@/components/frameworks/framework-runner'
import { loadFramework } from '../load-framework'

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
