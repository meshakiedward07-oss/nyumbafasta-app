import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Futa Data Yako',
  description: 'Ombi la kufuta data yako ya kibinafsi kutoka NyumbaFasta — hatua rahisi na za haraka.',
  alternates: { canonical: 'https://nyumbafasta.co/data-deletion' },
  robots: { index: true, follow: true },
}

export default function DataDeletionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
