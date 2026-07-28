import type { Metadata } from 'next'

// Override the parent auth layout's noindex — register is a public conversion page
export const metadata: Metadata = {
  title: 'Jiunge na NyumbaFasta — Dalali au Mteja',
  description: 'Jiunge na NyumbaFasta bure. Dalali: pata wateja zaidi kwa Tsh 10,000/mwezi. Mteja: tafuta nyumba ya kupanga Tanzania.',
  alternates: { canonical: 'https://nyumbafasta.co/register' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Jiunge na NyumbaFasta',
    description: 'Dalali: pata wateja zaidi. Mteja: tafuta nyumba haraka. Jiunge bure leo.',
    url: 'https://nyumbafasta.co/register',
    type: 'website',
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
