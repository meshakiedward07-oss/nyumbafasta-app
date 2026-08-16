'use client'
import dynamic from 'next/dynamic'

const PropertyDashboard = dynamic(() => import('./PropertyDashboard'), { ssr: false })

export default function PropertyLoader() {
  return <PropertyDashboard />
}
