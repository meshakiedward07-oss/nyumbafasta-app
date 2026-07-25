import dynamic from 'next/dynamic'

// ssr: false — AdminUsersClient fetches all data client-side via useEffect.
// Skipping SSR eliminates a server-side DB hit on every page visit and
// defers the large JS bundle until after initial HTML is painted.
const AdminUsersClient = dynamic(
  () => import('@/components/admin/AdminUsersClient'),
  { ssr: false }
)

export default function AdminUsersPage() {
  return <AdminUsersClient />
}
