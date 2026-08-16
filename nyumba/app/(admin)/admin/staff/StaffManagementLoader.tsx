'use client'
import dynamic from 'next/dynamic'

const StaffManagementClient = dynamic(() => import('./StaffManagementClient'), { ssr: false })

export default function StaffManagementLoader() {
  return <StaffManagementClient />
}
