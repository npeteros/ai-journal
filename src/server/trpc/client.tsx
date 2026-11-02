'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useState, type ReactNode } from 'react'
import { makeQueryClient } from './query-client'
import type { AppRouter } from './routers/_app'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

function getUrl() {
  if (typeof window !== 'undefined') {
    return '/api/trpc'
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  return `${baseUrl}/api/trpc`
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getUrl() })],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
