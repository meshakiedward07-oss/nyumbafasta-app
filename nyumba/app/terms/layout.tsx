import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masharti ya Matumizi',
  description: 'Masharti na Sheria za kutumia NyumbaFasta — platform ya kupata nyumba Tanzania.',
  alternates: { canonical: 'https://nyumbafasta.co/terms' },
  robots: { index: true, follow: true },
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
