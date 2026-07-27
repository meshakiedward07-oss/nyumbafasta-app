import dynamic from 'next/dynamic'

export const metadata = { title: 'Usimamizi wa Mali — Admin' }

const PropertyDashboard = dynamic(() => import('./PropertyDashboard'), { ssr: false })

export default function PropertyManagementAdminPage() {
  return <PropertyDashboard />
}
