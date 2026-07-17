import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'

async function getPlans() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ad_subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  return data ?? []
}

const TYPE_LABELS: Record<string, string> = {
  banner:   'Banner Ad',
  search:   'Search Ad',
  nearby:   'Nearby Ad',
  video:    'Video Ad',
  featured: 'Featured Business',
}

const TYPE_ICONS: Record<string, string> = {
  banner:   '🎯',
  search:   '🔍',
  nearby:   '📍',
  video:    '🎬',
  featured: '⭐',
}

const TYPE_DESC: Record<string, string> = {
  banner:   'Onyesha tangazo lako kubwa juu ya ukurasa wa nyumba — waonane na maelfu ya wateja kila siku.',
  search:   'Tangazo lako linaonekana kwenye matokeo ya utafutaji — wateja wanaotafuta wanakuona kwanza.',
  nearby:   'Fikia wateja wanaotazama nyumba karibu na eneo lako.',
  video:    'Onyesha video ya biashara yako — ongeza imani na uharisi kwa wateja.',
  featured: 'Orodhesha biashara yako kwenye ukurasa wa Featured Businesses kwa mkoa wako.',
}

export default async function AdvertisingLandingPage() {
  const plans = await getPlans()

  const byType = plans.reduce<Record<string, typeof plans>>((acc, p) => {
    const t = p.ad_type as string
    if (!acc[t]) acc[t] = []
    acc[t].push(p)
    return acc
  }, {})

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 to-primary-900 text-white py-16 px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Fikia Wateja Zaidi na NyumbaFasta
        </h1>
        <p className="text-primary-100 text-lg max-w-2xl mx-auto mb-8">
          Watangazo wa biashara ambao unaweza kusimamia mwenyewe.
          Weka tangazo lako, lipa kwa simu, uanze kuonekana mara moja.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/advertising/register"
            className="bg-white text-primary-700 font-bold px-6 py-3 rounded-xl hover:bg-primary-50 transition"
          >
            Anza Sasa — Bure
          </Link>
          <Link
            href="/advertising/login"
            className="border border-white/40 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition"
          >
            Ingia kwenye Akaunti
          </Link>
        </div>
      </section>

      {/* Why NyumbaFasta Ads */}
      <section className="max-w-5xl mx-auto py-12 px-4">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">Kwa Nini Utangaze Hapa?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '📱', title: 'Wateja Halisi', desc: 'Watumizi wa NyumbaFasta wanatafuta nyumba na huduma — wateja wako tayari wako hapa.' },
            { icon: '💳', title: 'Lipa kwa Simu', desc: 'M-Pesa, Airtel Money, Tigo Pesa — hakuna lolote la ugumu, lipa kwa dakika moja.' },
            { icon: '📊', title: 'Simamia Mwenyewe', desc: 'Angalia takwimu, badilisha maudhui, simamia kampeni yako — bila msaada wa mtu mwingine.' },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans by type */}
      <section className="max-w-5xl mx-auto pb-16 px-4">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-10">Mipango ya Matangazo</h2>

        {Object.entries(byType).map(([type, typePlans]) => (
          <div key={type} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{TYPE_ICONS[type] ?? '📢'}</span>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{TYPE_LABELS[type] ?? type}</h3>
                <p className="text-sm text-gray-500">{TYPE_DESC[type] ?? ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {typePlans.map(plan => (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-gray-800">{plan.name}</h4>
                      {plan.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary-600">
                        TZS {plan.price_tzs.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">kwa siku {plan.duration_days}</div>
                    </div>
                  </div>

                  {plan.features?.length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {(plan.features as string[]).map(f => (
                        <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="text-primary-500">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href={`/advertising/new?plan=${plan.id}`}
                    className="block w-full text-center bg-primary-500 text-white font-medium py-2 rounded-xl hover:bg-primary-600 transition text-sm"
                  >
                    Chagua Mpango Huu
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <p className="text-center text-gray-400 py-12">Mipango ya matangazo itaonekana hivi karibuni.</p>
        )}
      </section>
    </div>
  )
}
