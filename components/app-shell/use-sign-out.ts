'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { signOut } from '@/src/lib/auth-client'

/** Signs the user out and sends them to /login. Shared by the sidebar footer and mobile account sheet. */
export function useSignOut() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOutUser() {
    setPending(true)
    setError(null)

    const { error } = await signOut()
    if (error) {
      setError(error.message || 'Could not sign out. Please try again.')
      setPending(false)
      return
    }

    // Left pending on success so the button stays disabled until the navigation lands.
    router.push('/login')
    router.refresh()
  }

  return { signOut: signOutUser, pending, error }
}
