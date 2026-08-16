'use client'
import dynamic from 'next/dynamic'

const StaffDashboardClient = dynamic(() => import('./StaffDashboardClient'), { ssr: false })

export default function StaffDashboardLoader() {
  return <StaffDashboardClient />
}
