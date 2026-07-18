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

const TYPE_META: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  directory: { label: 'Business Directory',    icon: '🏪', desc: 'Orodha ya biashara yako kwa wateja wanaotafuta huduma karibu nawe.', color: 'bg-amber-50 border-amber-200' },
  nearby:    { label: 'Nearby Ads',            icon: '📍', desc: 'Fikia wateja wanaotazama nyumba karibu na eneo lako — mara wanapoitazama.',  color: 'bg-blue-50 border-blue-200' },
  featured:  { label: 'Featured Business',     icon: '⭐', desc: 'Biashara yako inaonekana mara ya kwanza kwenye ukurasa wa mkoa wako.',   color: 'bg-purple-50 border-purple-200' },
  banner:    { label: 'Banner Ad',             icon: '🎯', desc: 'Picha kubwa ya tangazo juu ya ukurasa wa nyumbani — maelfu wanakuona.',   color: 'bg-green-50 border-green-200' },
  search:    { label: 'Search Ads',            icon: '🔍', desc: 'Wateja wanaotafuta wanakuona kwanza kabla ya wengine.',                   color: 'bg-orange-50 border-orange-200' },
  video:     { label: 'Video Ads',             icon: '🎬', desc: 'Video ya biashara yako inaonyeshwa kwa wateja — imani na uharisi zaidi.', color: 'bg-red-50 border-red-200' },
  bundle:    { label: 'Bundle',                icon: '📦', desc: 'Mchanganyiko wa aina nyingi za matangazo kwa bei moja nzuri.',            color: 'bg-primary-50 border-primary-200' },
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
    <div className="pb-16">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-[#063d2d] via-[#085041] to-[#1D9E75] text-white px-4 pt-10 pb-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            📢 Jukwaa la Matangazo — Tanzania
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 tracking-tight">
            Weka Biashara Yako Mbele ya<br className="hidden sm:block" />{' '}
            <span className="text-amber-300">Wateja Sahihi</span>
          </h1>
          <p className="text-primary-100 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Tangaza biashara yako kwenye NyumbaFasta — jukwaa kubwa la nyumba na huduma Tanzania.
            Wateja wanakutafuta. Wataki wakuone.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/advertising/register"
              className="bg-white text-primary-700 font-bold px-7 py-3.5 rounded-2xl hover:bg-primary-50 transition text-sm shadow-lg"
            >
              Anza Bure — Dakika 2 tu
            </Link>
            <Link
              href="/advertising/login"
              className="border border-white/30 text-white font-medium px-7 py-3.5 rounded-2xl hover:bg-white/10 transition text-sm"
            >
              Nina Akaunti → Ingia
            </Link>
          </div>
        </div>

        {/* Trust stats */}
        <div className="max-w-xl mx-auto mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { num: '10,000+', lbl: 'Watumizi kila mwezi' },
            { num: '31',      lbl: 'Mikoa Tanzania' },
            { num: '24h',     lbl: 'Ukaguzi wa haraka' },
          ].map(s => (
            <div key={s.lbl} className="bg-white/10 rounded-xl py-3 px-2">
              <div className="text-xl font-extrabold">{s.num}</div>
              <div className="text-xs text-primary-200 mt-0.5">{s.lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-8">Jinsi Inavyofanya Kazi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '1', icon: '📝', title: 'Jiandikishe Bure', desc: 'Jaza taarifa za biashara yako. Hakuna ada ya kuanza.' },
            { step: '2', icon: '📋', title: 'Chagua Mpango', desc: 'Chagua aina ya tangazo na mpango unaofaa bajeti yako.' },
            { step: '3', icon: '🚀', title: 'Anza Kuonekana', desc: 'Baada ya ukaguzi wa admin, lipa na tangazo lako linaanza mara moja.' },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl mb-3">
                {s.icon}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {s.step}
                </span>
                <h3 className="font-bold text-gray-800 text-sm">{s.title}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Mipango ya Matangazo</h2>
          <p className="text-sm text-gray-500 text-center mb-8">Chagua aina ya tangazo inayofaa biashara yako</p>
        </div>

        {plans.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">
            Mipango ya matangazo itaonekana hivi karibuni.
          </p>
        )}

        {Object.entries(byType).map(([type, typePlans]) => {
          const meta = TYPE_META[type] ?? { label: type, icon: '📢', desc: '', color: 'bg-gray-50 border-gray-200' }
          return (
            <div key={type} className="max-w-3xl mx-auto mb-10">
              <div className="flex items-center gap-2 mb-3 px-0">
                <span className="text-xl">{meta.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">{meta.label}</h3>
                  {meta.desc && <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>}
                </div>
              </div>

              {/* Horizontal scroll on mobile, grid on desktop */}
              <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible snap-x snap-mandatory">
                {typePlans.map(plan => (
                  <div
                    key={plan.id}
                    className={`flex-shrink-0 w-72 sm:w-auto snap-start bg-white rounded-2xl border-2 p-4 shadow-sm hover:shadow-md transition ${meta.color}`}
                  >
                    <div className="mb-3">
                      <h4 className="font-bold text-gray-800 text-sm mb-0.5">{plan.name}</h4>
                      {plan.description && (
                        <p className="text-xs text-gray-500">{plan.description}</p>
                      )}
                    </div>

                    {plan.features?.length > 0 && (
                      <ul className="space-y-1 mb-4">
                        {(plan.features as string[]).map(f => (
                          <li key={f} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-primary-500 mt-0.5 flex-shrink-0">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <div className="text-lg font-extrabold text-primary-600">
                          TZS {plan.price_tzs.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-gray-400">kwa siku {plan.duration_days}</div>
                      </div>
                      <Link
                        href={`/advertising/new?plan=${plan.id}`}
                        className="bg-primary-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-primary-600 transition"
                      >
                        Chagua →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* ── Benefits ── */}
      <section className="bg-white border-y border-gray-100 px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-8">Kwa Nini NyumbaFasta Ads?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '👥', title: 'Wateja Halisi', desc: 'Watumizi wetu wanatafuta nyumba na huduma — hawapotezi muda.' },
              { icon: '💳', title: 'Lipa kwa Simu', desc: 'M-Pesa, Airtel Money, Tigo Pesa. Rahisi, salama, haraka.' },
              { icon: '📊', title: 'Takwimu za Wakati Halisi', desc: 'Angalia views, clicks, na wasiliano wapya kila wakati.' },
            ].map(b => (
              <div key={b.title} className="flex gap-3 items-start sm:flex-col sm:items-center sm:text-center">
                <div className="w-11 h-11 bg-primary-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {b.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm mb-0.5">{b.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-4 py-14">
        <div className="max-w-lg mx-auto bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-8 text-center text-white shadow-xl">
          <div className="text-3xl mb-3">🚀</div>
          <h2 className="text-xl font-bold mb-2">Anza Leo — Bila Gharama</h2>
          <p className="text-primary-100 text-sm mb-6">
            Jiandikishe bure na anza kuweka tangazo lako ndani ya dakika 5.
          </p>
          <Link
            href="/advertising/register"
            className="inline-block bg-white text-primary-700 font-bold px-8 py-3 rounded-2xl hover:bg-primary-50 transition shadow-md"
          >
            Anza Bure Sasa
          </Link>
          <p className="text-xs text-primary-200 mt-4">
            Tayari una akaunti?{' '}
            <Link href="/advertising/login" className="underline">Ingia hapa</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
