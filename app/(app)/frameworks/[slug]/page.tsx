import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Page } from '@/components/app-shell/page'
import { FrameworkRunner } from '@/components/frameworks/framework-runner'
import { getPlaceholderFramework, placeholderFrameworks } from '@/src/lib/placeholder/frameworks'

export async function generateMetadata(props: PageProps<'/frameworks/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  return { title: getPlaceholderFramework(slug)?.title ?? 'Framework' }
}

export function generateStaticParams() {
  return placeholderFrameworks.map((f) => ({ slug: f.slug }))
}

export default async function FrameworkEntryPage(props: PageProps<'/frameworks/[slug]'>) {
  const { slug } = await props.params
  const framework = getPlaceholderFramework(slug)
  if (!framework) notFound()

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkRunner framework={framework} />
    </Page>
  )
}
