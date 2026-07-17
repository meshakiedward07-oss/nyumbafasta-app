import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FeaturedCard from '@/components/ads/FeaturedCard'
import type { Metadata } from 'next'

export const revalidate = 3600

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  const decoded = decodeURIComponent(city)
  return {
    title: `Biashara Zilizoangaziwa — ${decoded} | NyumbaFasta`,
    description: `Pata biashara bora zilizopitishwa katika ${decoded} kwenye NyumbaFasta Tanzania.`,
  }
}

async function getFeaturedForCity(city: string) {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data } = await admin
    .from('ad_campaigns')
    .select(`
      id, title, body_text, image_url, cta_type, cta_value, target_region,
      advertiser:advertiser_id (
        id, business_name, business_category, logo_url, whatsapp_number
      )
    `)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('ad_type', 'featured')
    .eq('target_region', city)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  return data ?? []
}

export default async function CityDirectoryPage({ params }: Props) {
  const { city } = await params
  const decoded = decodeURIComponent(city)

  const ads = await getFeaturedForCity(decoded)
  if (ads.length === 0) notFound()

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-2">
        <Link href="/directory" className="text-sm text-primary-600 hover:underline">
          ← Biashara Zote
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          ⭐ Biashara Zilizoangaziwa
          <span className="text-primary-600">{decoded}</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Biashara {ads.length} zilizopitishwa katika {decoded}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ads.map(ad => (
          <FeaturedCard key={ad.id} ad={ad as unknown as Parameters<typeof FeaturedCard>[0]['ad']} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-400">
          Taka biashara yako iangaziwe hapa?{' '}
          <Link href="/advertising" className="text-primary-600 hover:underline font-medium">
            Tangaza leo — Nafasi ni chache
          </Link>
        </p>
      </div>
    </div>
  )
}
