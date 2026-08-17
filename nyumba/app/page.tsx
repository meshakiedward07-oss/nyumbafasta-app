import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import HomeClient from '@/components/home/HomeClient'
import RegionLinks from '@/components/seo/RegionLinks'
import type { ListingWithDalali } from '@/lib/types/database'

export const metadata: Metadata = {
  title: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
  description: 'Tafuta vyumba, apartments na nyumba Tanzania kwa urahisi. Zungumza na dalali moja kwa moja. Listings mpya kila siku — Dar es Salaam, Arusha, Mwanza na mikoa yote Tanzania.',
  keywords: ['nyumba Tanzania', 'vyumba Dar es Salaam', 'apartment kupanga', 'chumba Kinondoni', 'dalali nyumba', 'nyumba ya kupanga Tanzania'],
  alternates: { canonical: 'https://nyumbafasta.co' },
  openGraph: {
    title: 'NyumbaFasta — Pata Nyumba Haraka Tanzania',
    description: 'Tafuta vyumba na apartments Tanzania kwa urahisi. Listings mpya kila siku.',
    url: 'https://nyumbafasta.co',
    type: 'website',
  },
}

// ISR: re-render at most every 60 seconds — fresh listings without full SSR on every request
export const revalidate = 60

const LISTING_FIELDS = `
  id, title, type, status, price_monthly,
  district, region, ward, furnished, amenities,
  images, is_boosted, boosted_until,
  view_count, lead_count, share_count, latitude, longitude,
  created_at, commission_type,
  dalali_id,
  dalali:dalali_id (
    id, full_name, avatar_url,
    dalali_profiles ( rating_avg, is_premium_verified, is_favourite_dalali )
  )
`

export default async function Page() {
  // Fetch first page of listings server-side so the initial HTML contains real content
  const supabase = createAdminClient()
  const { data, count } = await supabase
    .from('listings')
    .select(LISTING_FIELDS, { count: 'exact' })
    .eq('status', 'active')
    .eq('is_sub_suspended', false)
    .order('is_boosted', { ascending: false })
    .order('boosted_until', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <>
      <HomeClient
        initialListings={(data as unknown as ListingWithDalali[]) ?? []}
        initialTotal={count ?? 0}
      />
      {/* Server-rendered SEO region links — crawlable internal links */}
      <div className="pb-24">
        <RegionLinks />
      </div>
    </>
  )
}
