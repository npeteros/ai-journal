'use client'

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { MotionConfig } from 'motion/react'

/** Light / dark / system theme (class on <html>) + app-wide motion defaults. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* "user" = respect the OS reduced-motion setting for every motion component */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  )
}
