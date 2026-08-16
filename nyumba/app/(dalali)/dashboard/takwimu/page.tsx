'use client'
import dynamic from 'next/dynamic'

const DalaliTakwimuClient = dynamic(() => import('./DalaliTakwimuClient'), { ssr: false })

export default function TakwimuPage() {
  return <DalaliTakwimuClient />
}
