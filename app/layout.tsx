import type { Metadata } from 'next'
import { TRPCReactProvider } from '@/src/server/trpc/client'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { fontVariables } from '@/src/lib/design-tokens/typography'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'JADEN', template: '%s · JADEN' },
  description: 'A private journal that grows with you.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // next-themes sets the theme class on <html> before hydration
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      {/* Browser extensions often inject attributes on <body>; ignore those attribute mismatches */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
