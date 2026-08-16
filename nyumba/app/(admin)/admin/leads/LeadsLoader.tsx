'use client'
import dynamic from 'next/dynamic'

const LeadsClient = dynamic(() => import('./LeadsClient'), { ssr: false })

export default function LeadsLoader() {
  return <LeadsClient />
}
