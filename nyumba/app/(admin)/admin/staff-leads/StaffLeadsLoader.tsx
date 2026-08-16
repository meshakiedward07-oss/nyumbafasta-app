'use client'
import dynamic from 'next/dynamic'

const StaffLeadsClient = dynamic(() => import('./StaffLeadsClient'), { ssr: false })

export default function StaffLeadsLoader(props: { currentUserId: string; isAdmin: boolean }) {
  return <StaffLeadsClient {...props} />
}
