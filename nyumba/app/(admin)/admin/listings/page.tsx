import AdminDashboard from '@/components/admin/AdminDashboard'
import { getAdminData } from '@/lib/admin/getData'

export default async function AdminListingsPage() {
  const data = await getAdminData()
  return (
    <AdminDashboard
      pendingListings={data.pendingListings}
      allListings={data.allListings}
      users={data.users}
      unlocks={data.unlocks}
      subscriptions={data.subscriptions}
      pendingVerifications={data.pendingVerifications}
      madalaliDetailed={data.madalaliDetailed}
      watejaDetailed={data.watejaDetailed}
      savedListings={data.savedListings}
      reports={data.reports as Parameters<typeof AdminDashboard>[0]['reports']}
      regionStats={data.regionStats}
      stats={data.stats}
      initialTab="listings"
    />
  )
}
