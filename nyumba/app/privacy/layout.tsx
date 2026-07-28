import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sera ya Faragha',
  description: 'Sera ya Faragha ya NyumbaFasta — jinsi tunavyolinda taarifa zako za kibinafsi.',
  alternates: { canonical: 'https://nyumbafasta.co/privacy' },
  robots: { index: true, follow: true },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
