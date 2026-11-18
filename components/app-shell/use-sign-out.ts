'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { signOut } from '@/src/lib/auth-client'

/** Indirection so tests can observe the full-page navigation (jsdom can't replace `location`). */
export const fullPageNavigation = {
  assign: (url: string) => window.location.assign(url),
}

/** Signs the user out and sends them to /login. Shared by the sidebar footer and mobile account sheet. */
export function useSignOut() {
  const queryClient = useQueryClient()
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

    queryClient.clear()
    fullPageNavigation.assign('/login')
  }

  return { signOut: signOutUser, pending, error }
}
