import type { Metadata, Viewport } from 'next'
import { TRPCReactProvider } from '@/src/server/trpc/client'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar'
import { fontVariables } from '@/src/lib/design-tokens/typography'
import { site } from '@/src/lib/site'
import './globals.css'

// Icons (favicon.ico, icon.svg, apple-icon.png), OG/Twitter images, manifest, robots and sitemap
// are file conventions in app/. Regenerate the icon files with `npm run brand:icons`.
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.name,
  category: 'lifestyle',
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: site.title,
    description: site.description,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: site.colors.paper },
    { media: '(prefers-color-scheme: dark)', color: site.colors.paperDark },
  ],
  colorScheme: 'light dark',
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
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
