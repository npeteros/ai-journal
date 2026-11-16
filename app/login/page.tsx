import type { Metadata } from 'next'

import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { LoginForm } from '@/components/auth/login-form'
import { getSafeRedirect } from '@/src/lib/auth/redirect'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage(props: PageProps<'/login'>) {
  const { redirect } = await props.searchParams
  // Sanitized here so the client form only ever receives a same-origin path.
  const redirectTo = getSafeRedirect(redirect)

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in to keep your journal private and synced."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthSplitLayout>
  )
}
