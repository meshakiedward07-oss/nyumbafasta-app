import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import ClientProviders from '@/components/shared/ClientProviders'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
  preload: true,
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
  preload: false,
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// Global Organization schema — describes NyumbaFasta to search engines & AI crawlers
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'NyumbaFasta',
  url: APP_URL,
  logo: `${APP_URL}/logo_nyumbafasta.png`,
  description: 'Platform ya kupata nyumba Tanzania kwa urahisi na haraka',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+255665831694',
    contactType: 'customer service',
    availableLanguage: ['Swahili', 'English'],
  },
  sameAs: [],
  areaServed: {
    '@type': 'Country',
    name: 'Tanzania',
  },
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
    template: '%s | NyumbaFasta',
  },
  description:
    'Tafuta vyumba, apartments na nyumba Tanzania kwa urahisi. Zungumza na dalali moja kwa moja. Haraka & Kwa Uhakika.',
  keywords: [
    'nyumba Tanzania',
    'vyumba Dar es Salaam',
    'apartment Kinondoni',
    'house for rent Tanzania',
    'dalali nyumba',
    'NyumbaFasta',
    'chumba cha kupanga',
    'nyumba ya kupanga',
    'vyumba Arusha',
    'apartments Mwanza',
  ],
  authors: [{ name: 'NyumbaFasta' }],
  creator: 'NyumbaFasta',
  publisher: 'NyumbaFasta',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'sw_TZ',
    url: APP_URL,
    siteName: 'NyumbaFasta',
    title: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
    description: 'Tafuta vyumba na apartments Tanzania kwa urahisi. Zungumza na dalali moja kwa moja.',
    images: [
      {
        url: '/transparent_logo_nyumbafasta.png',
        width: 1200,
        height: 630,
        alt: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
    description: 'Tafuta vyumba na apartments Tanzania kwa urahisi',
    images: ['/transparent_logo_nyumbafasta.png'],
  },
  icons: {
    icon: '/transparent_logo_nyumbafasta.png',
    apple: '/transparent_logo_nyumbafasta.png',
  },
  manifest: '/manifest.json',
  verification: {
    google: 'google0bea6c13cf3f6ac6',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#1D9E75',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://bnrrkmeqkxwooihhqaxe.supabase.co" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://bnrrkmeqkxwooihhqaxe.supabase.co" />
        {/* Organization structured data — SEO & AI search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans bg-gray-50 min-h-screen antialiased`}
        suppressHydrationWarning
      >
        {children}
        <ClientProviders />
      </body>
    </html>
  )
}
