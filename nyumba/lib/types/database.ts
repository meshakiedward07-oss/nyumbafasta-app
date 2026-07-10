export type UserRole = 'client' | 'dalali' | 'admin' | 'staff'
export type ListingStatus = 'pending' | 'active' | 'taken' | 'expired' | 'rejected' | 'deleted'
export type ListingType = 'chumba' | 'apartment' | 'nyumba' | 'studio' | 'duka'
export type FurnishedStatus = 'furnished' | 'semi' | 'empty'
export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise'

export type Listing = {
  id: string
  dalali_id: string
  title: string
  type: ListingType
  status: ListingStatus
  price_monthly: number
  district: string
  region: string
  ward: string | null
  mtaa: string | null
  location_display: string | null
  address_full: string | null
  place_id: string | null
  furnished: FurnishedStatus
  amenities: string[]
  images: string[]
  video_url: string | null
  description: string | null
  bedrooms: number | null
  deposit_months: number | null
  shop_size_sqm: number | null
  floor_level: number | null
  has_parking: boolean | null
  has_electricity: boolean | null
  has_water: boolean | null
  commercial_use: string | null
  street: string
  is_boosted: boolean
  boosted_until: string | null
  boost_count: number
  view_count: number
  lead_count: number
  share_count: number
  latitude: number | null
  longitude: number | null
  rejection_reason: string | null
  expires_at: string | null
  renewed_at: string | null
  renewal_count: number
  expiry_reminded_at: string | null
  approved_at: string | null
  created_at: string
  listing_unit_type: 'single' | 'multi'
  total_capacity: number
  current_occupancy: number
  auto_deactivate_on_full: boolean
  occupancy_last_updated: string | null
  auto_deactivated_at: string | null
}

export type User = {
  id: string
  phone: string | null
  full_name: string
  role: UserRole
  avatar_url: string | null
  is_verified: boolean
  is_active: boolean
  region: string | null
  created_at: string
  last_seen_at: string | null
}

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'

export type DalaliProfile = {
  id: string
  user_id: string
  whatsapp_number: string
  bio: string | null
  operating_areas: string[] | null
  rating_avg: number
  rating_count: number
  is_premium_verified: boolean
  is_favourite_dalali: boolean
  total_leads: number
  verification_status: VerificationStatus
  nida_number: string | null
  nida_image_front: string | null
  nida_image_back: string | null
  selfie_image: string | null
  verification_submitted_at: string | null
  verification_approved_at: string | null
  verification_rejected_reason: string | null
}

export type Subscription = {
  id: string
  dalali_id: string
  plan: SubscriptionPlan
  status: 'pending' | 'active' | 'grace_period' | 'expired' | 'cancelled'
  amount_paid: number | null
  payment_method: string | null
  payment_ref: string | null
  starts_at: string | null
  expires_at: string
  auto_renew: boolean
  grace_period_until: string | null
  renewal_reminded_at: string | null
  created_at: string
}

export type ContactUnlock = {
  id: string
  client_id: string
  listing_id: string
  dalali_id: string
  amount_paid: number
  payment_method: string | null
  payment_ref: string | null
  status: 'pending' | 'completed' | 'failed'
  expires_at: string | null
  whatsapp_opened_at: string | null
  created_at: string
}

export type Review = {
  id: string
  unlock_id: string
  reviewer_id: string
  dalali_id: string
  listing_id: string | null
  rating: number
  comment: string | null
  found_house: boolean | null
  created_at: string
  is_verified: boolean
  helpful_count: number
  response: string | null
  response_at: string | null
}

export type SavedListing = {
  id: string
  client_id: string
  listing_id: string
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  is_read: boolean
  ref_id: string | null
  data: Record<string, unknown> | null
  send_at: string | null
  created_at: string
}

// Joined type for listing cards
export type ListingWithDalali = Listing & {
  dalali: (User & {
    dalali_profiles: Pick<DalaliProfile, 'rating_avg' | 'is_premium_verified' | 'is_favourite_dalali'> | null
  }) | null
}
