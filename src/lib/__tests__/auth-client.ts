import { createAuthClient } from 'better-auth/react'

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  changePassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = createAuthClient()
