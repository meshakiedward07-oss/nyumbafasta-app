import AdminDashboard from '@/components/admin/AdminDashboard'
import { getAdminData } from '@/lib/admin/getData'

export default async function AdminPage() {
  const data = await getAdminData()
  return (
    <AdminDashboard
      pendingListings={data.pendingListings}
      allListings={data.allListings}
      pendingVerifications={data.pendingVerifications}
      reports={data.reports as Parameters<typeof AdminDashboard>[0]['reports']}
      regionStats={data.regionStats}
      stats={data.stats}
    />
  )
}

// ── Types ─────────────────────────────────────────────────

export type AdminListing = {
  id: string
  title: string
  type: string
  status: string
  price_monthly: number
  district: string
  region: string
  furnished: string
  amenities: string[]
  images: string[]
  description: string | null
  bedrooms: number | null
  created_at: string
  is_boosted?: boolean
  dalali: {
    id: string
    full_name: string
    phone: string | null
    dalali_profiles: { whatsapp_number: string; is_premium_verified: boolean } | null
  } | null
}


export type AdminVerification = {
  user_id: string
  nida_number: string | null
  nida_image_front: string | null
  nida_image_back: string | null
  selfie_image: string | null
  business_license_url: string | null
  verification_status: string
  verification_submitted_at: string | null
  verification_rejected_reason: string | null
  user: { id: string; full_name: string; phone: string | null } | null
}

