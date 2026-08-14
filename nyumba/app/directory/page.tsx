import { createAdminClient } from '@/lib/supabase/server'
import { REGION_NAMES } from '@/lib/data/tanzania-locations'
import DirectoryContent from './DirectoryContent'

export const metadata = {
  title: 'Biashara Zilizoangaziwa — NyumbaFasta',
  description: 'Pata madalali wa nyumba walioangaziwa Tanzania. Dalali wa kuaminika katika Dar es Salaam, Arusha, Mwanza na mikoa yote.',
  alternates: { canonical: 'https://nyumbafasta.co/directory' },
  robots: { index: true, follow: true },
}
export const revalidate = 3600

async function getCitiesWithFeatured(): Promise<string[]> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data } = await admin
    .from('ad_campaigns')
    .select('target_region')
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('ad_type', 'featured')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const cities = [...new Set((data ?? []).map(d => d.target_region))]
  // Preserve REGION_NAMES order
  return REGION_NAMES.filter(r => cities.includes(r))
}

export default async function DirectoryPage() {
  const cities = await getCitiesWithFeatured()
  return <DirectoryContent cities={cities} />
}
