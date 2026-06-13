import AdminShell from '@/components/admin/AdminShell'
import SocialDashboard from './SocialDashboard'

export const metadata = { title: 'Social Media — NyumbaFasta Admin' }

export default function SocialPage() {
  return (
    <AdminShell>
      <SocialDashboard />
    </AdminShell>
  )
}
