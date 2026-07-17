import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { REGION_NAMES } from '@/lib/data/tanzania-locations'

export const metadata = { title: 'Biashara Zilizoangaziwa — NyumbaFasta' }
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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⭐ Biashara Zilizoangaziwa</h1>
        <p className="text-gray-500">
          Pata biashara bora zilizopitishwa na NyumbaFasta katika mkoa wako.
        </p>
      </div>

      {cities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🏙️</div>
          <h2 className="text-xl font-bold text-gray-600 mb-2">Hakuna Biashara Bado</h2>
          <p className="text-sm">Biashara zilizoangaziwa zitaonekana hapa. Jiandikishe kama mfanyabiashara.</p>
          <Link
            href="/advertising/register"
            className="inline-block mt-4 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition"
          >
            Jiandikishe Bure
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {cities.map(city => (
            <Link
              key={city}
              href={`/directory/${encodeURIComponent(city)}`}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition text-center"
            >
              <div className="text-3xl mb-2">🏙️</div>
              <h2 className="font-bold text-gray-800">{city}</h2>
              <p className="text-sm text-primary-600 mt-1">Angalia biashara →</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-400">
          Je, una biashara?{' '}
          <Link href="/advertising" className="text-primary-600 hover:underline font-medium">
            Tangaza biashara yako hapa
          </Link>
        </p>
      </div>
    </div>
  )
}
