import AdminDashboard from '@/components/admin/AdminDashboard'
import { getAdminData } from '@/lib/admin/getData'

export default async function AdminPage() {
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

export type AdminUser = {
  id: string
  full_name: string
  phone: string | null
  role: string
  created_at: string
}

export type AdminUnlock = {
  id: string
  amount_paid: number
  created_at: string
  listing_id: string
  client_id: string | null
}

export type AdminSubscription = {
  id: string
  plan: string
  status: string
  expires_at: string
  dalali_id: string
  created_at: string
}

export type AdminVerification = {
  user_id: string
  nida_number: string | null
  nida_image_front: string | null
  nida_image_back: string | null
  selfie_image: string | null
  verification_status: string
  verification_submitted_at: string | null
  verification_rejected_reason: string | null
  user: { id: string; full_name: string; phone: string | null } | null
}

export type AdminDalaliDetailed = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  is_active: boolean | null
  dalali_profiles: {
    whatsapp_number: string | null
    verification_status: string | null
    is_premium_verified: boolean
    rating_avg: number | null
  } | null
  subscriptions: { plan: string; status: string; expires_at: string | null }[]
}

export type AdminClientDetailed = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  is_active: boolean | null
}
