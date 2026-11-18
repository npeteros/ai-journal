import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Page } from '@/components/app-shell/page'
import { FrameworkBuilder } from '@/components/frameworks/framework-builder'
import { isFrameworkIconName } from '@/components/frameworks/framework-icon'
import { loadFramework } from '../../load-framework'

export const metadata: Metadata = { title: 'Edit framework' }

export default async function FrameworkEditPage(props: PageProps<'/frameworks/[slug]/edit'>) {
  const { slug } = await props.params
  const framework = await loadFramework(slug)
  // Built-in templates and other users' frameworks can't be updated, so there is nothing to edit.
  if (!framework.isOwn) notFound()

  return (
    <Page tone="meadow" className="lg:pt-8">
      <FrameworkBuilder
        frameworkId={framework.id}
        initial={{
          title: framework.title,
          description: framework.description,
          icon: isFrameworkIconName(framework.icon) ? framework.icon : 'layers',
          prompts: framework.prompts,
        }}
      />
    </Page>
  )
}
