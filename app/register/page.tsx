import type { Metadata } from 'next'

import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <AuthSplitLayout
      title="Create your account"
      subtitle="Start a private journal that grows with you."
    >
      <RegisterForm />
    </AuthSplitLayout>
  )
}
