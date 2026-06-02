export type PlanType = 'free' | 'basic' | 'premium' | 'enterprise'

export type Plan = {
  id: PlanType
  name: string
  price: number
  color: string
  bgColor: string
  borderColor: string
  emoji: string
  description: string
  listings: number
  photos: number
  extraListingPrice: number
  features: { label: string; included: boolean; highlight?: boolean }[]
  limits: {
    listings: number
    photos: number
    videos: boolean
    boost: boolean
    analytics: 'none' | 'basic' | 'full'
    verifiedBadge: boolean
    searchPriority: 'low' | 'medium' | 'high' | 'top'
    support: 'none' | 'email' | 'whatsapp' | 'priority'
    extraListings: boolean
  }
}

export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    color: '#6B7280',
    bgColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    emoji: '🏠',
    description: 'Anza bila malipo — daima bure',
    listings: 2,
    photos: 2,
    extraListingPrice: 0,
    features: [
      { label: 'Listings 2 active', included: true },
      { label: 'Picha 2 kwa listing', included: true },
      { label: 'WhatsApp visible kwa wateja', included: true },
      { label: 'Video ya listing', included: false },
      { label: 'Boost listing', included: false },
      { label: 'Verified badge', included: false },
      { label: 'Analytics', included: false },
      { label: 'Search priority', included: false },
      { label: 'Support', included: false },
    ],
    limits: {
      listings: 2, photos: 2, videos: false, boost: false,
      analytics: 'none', verifiedBadge: false,
      searchPriority: 'low', support: 'none', extraListings: false,
    },
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 10_000,
    color: '#1D9E75',
    bgColor: '#E1F5EE',
    borderColor: '#5DCAA5',
    emoji: '⭐',
    description: 'Kwa madalali wanaoanza',
    listings: 5,
    photos: 4,
    extraListingPrice: 2_000,
    features: [
      { label: 'Listings 5 active', included: true, highlight: true },
      { label: 'Picha 4 kwa listing', included: true },
      { label: 'WhatsApp visible kwa wateja', included: true },
      { label: 'Video ya listing', included: true, highlight: true },
      { label: 'Boost listing', included: false },
      { label: 'Verified badge', included: false },
      { label: 'Analytics ya msingi', included: true },
      { label: 'Search priority: Kati', included: true },
      { label: 'Email support', included: true },
      { label: 'Listings za ziada: +Tsh 2,000/kila moja', included: true },
    ],
    limits: {
      listings: 5, photos: 4, videos: true, boost: false,
      analytics: 'basic', verifiedBadge: false,
      searchPriority: 'medium', support: 'email', extraListings: true,
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 25_000,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FCD34D',
    emoji: '👑',
    description: 'Inayopendwa zaidi — kwa madalali wanaokua',
    listings: 20,
    photos: 10,
    extraListingPrice: 2_000,
    features: [
      { label: 'Listings 20 active', included: true, highlight: true },
      { label: 'Picha 10 kwa listing', included: true, highlight: true },
      { label: 'WhatsApp visible kwa wateja', included: true },
      { label: 'Video ya listing', included: true },
      { label: 'Boost listing — Tsh 5,000/wiki', included: true, highlight: true },
      { label: 'Verified badge ✓', included: true, highlight: true },
      { label: 'Analytics kamili', included: true, highlight: true },
      { label: 'Search priority: Juu', included: true },
      { label: 'WhatsApp support', included: true },
      { label: 'Listings za ziada: +Tsh 2,000/kila moja', included: true },
    ],
    limits: {
      listings: 20, photos: 10, videos: true, boost: true,
      analytics: 'full', verifiedBadge: true,
      searchPriority: 'high', support: 'whatsapp', extraListings: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 50_000,
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#A78BFA',
    emoji: '🏢',
    description: 'Kwa mawakala makubwa na real estate firms',
    listings: 50,
    photos: 20,
    extraListingPrice: 1_000,
    features: [
      { label: 'Listings 50 active', included: true, highlight: true },
      { label: 'Picha 20 kwa listing', included: true, highlight: true },
      { label: 'WhatsApp visible kwa wateja', included: true },
      { label: 'Video ya listing', included: true },
      { label: 'Boost listing — Tsh 5,000/wiki', included: true },
      { label: 'Verified badge ✓', included: true },
      { label: 'Analytics kamili + Export', included: true, highlight: true },
      { label: 'Search priority: TOP', included: true, highlight: true },
      { label: 'Priority support 24/7', included: true, highlight: true },
      { label: 'Listings za ziada: +Tsh 1,000/kila moja', included: true },
      { label: 'Custom branding', included: true, highlight: true },
      { label: 'Dedicated account manager', included: true, highlight: true },
    ],
    limits: {
      listings: 50, photos: 20, videos: true, boost: true,
      analytics: 'full', verifiedBadge: true,
      searchPriority: 'top', support: 'priority', extraListings: true,
    },
  },
]

export function getPlan(planId?: string | null): Plan {
  return SUBSCRIPTION_PLANS.find(p => p.id === planId) ?? SUBSCRIPTION_PLANS[0]
}

export function canUseFeature(planId: string | null | undefined, feature: keyof Plan['limits']): boolean {
  const plan = getPlan(planId)
  const value = plan.limits[feature]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (value === 'none') return false
  return true
}

export function getPhotoLimit(planId?: string | null): number {
  return getPlan(planId).limits.photos
}

export function getListingLimit(planId?: string | null): number {
  return getPlan(planId).limits.listings
}

export const PLAN_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  free:       { label: 'FREE',          color: '#6B7280', bg: '#F3F4F6' },
  basic:      { label: 'BASIC',         color: '#1D9E75', bg: '#E1F5EE' },
  premium:    { label: 'PREMIUM 👑',    color: '#F59E0B', bg: '#FFFBEB' },
  enterprise: { label: 'ENTERPRISE 🏢', color: '#7C3AED', bg: '#EDE9FE' },
}
