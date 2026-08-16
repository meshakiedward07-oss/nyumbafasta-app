'use client'
import dynamic from 'next/dynamic'

const AdminUsersClient = dynamic(
  () => import('@/components/admin/AdminUsersClient'),
  { ssr: false }
)

export default function AdminUsersPage() {
  return <AdminUsersClient />
}
