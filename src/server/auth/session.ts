import 'server-only'

import { headers } from 'next/headers'
import { cache } from 'react'

import { auth } from './auth'

/** The current request's session, looked up once and shared by the layout and pages. */
export const getServerSession = cache(async () => auth.api.getSession({ headers: await headers() }))
