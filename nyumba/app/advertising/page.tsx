import Link from 'next/link'
import type { ReactNode } from 'react'
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

/* ── Inline SVG icons ── */
const IcoMegaphone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 0 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z" />
  </svg>
)
const IcoUserPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3M13.5 4.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM3.75 21a6.75 6.75 0 0 1 13.5 0" />
  </svg>
)
const IcoClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  </svg>
)
const IcoBolt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M3.75 13.5 10.5 2.25 12 10.5h8.25L13.5 21.75 12 13.5H3.75Z" />
  </svg>
)
const IcoStore = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016c.55.623 1.354 1.016 2.25 1.016a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z" />
  </svg>
)
const IcoPin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
)
const IcoStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
  </svg>
)
const IcoPhoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
)
const IcoSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 21 15.803 15.803m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
)
const IcoVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
)
const IcoCube = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
)
const IcoUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
)
const IcoPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
  </svg>
)
const IcoChartBar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)
const IcoRocket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <path d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
  </svg>
)

/* ── Ad type metadata ── */
const TYPE_META: Record<string, {
  label: string
  icon: ReactNode
  iconCls: string
  desc: string
  color: string
}> = {
  directory: { label: 'Business Directory', icon: <IcoStore />,    iconCls: 'bg-amber-100 text-amber-600',   desc: 'Orodha ya biashara yako kwa wateja wanaotafuta huduma karibu nawe.',            color: 'bg-amber-50 border-amber-200' },
  nearby:    { label: 'Nearby Ads',         icon: <IcoPin />,      iconCls: 'bg-blue-100 text-blue-600',     desc: 'Fikia wateja wanaotazama nyumba karibu na eneo lako — mara wanapoitazama.',  color: 'bg-blue-50 border-blue-200' },
  featured:  { label: 'Featured Business',  icon: <IcoStar />,     iconCls: 'bg-purple-100 text-purple-600', desc: 'Biashara yako inaonekana mara ya kwanza kwenye ukurasa wa mkoa wako.',       color: 'bg-purple-50 border-purple-200' },
  banner:    { label: 'Banner Ad',          icon: <IcoPhoto />,    iconCls: 'bg-green-100 text-green-600',   desc: 'Picha kubwa ya tangazo juu ya ukurasa wa nyumbani — maelfu wanakuona.',     color: 'bg-green-50 border-green-200' },
  search:    { label: 'Search Ads',         icon: <IcoSearch />,   iconCls: 'bg-orange-100 text-orange-600', desc: 'Wateja wanaotafuta wanakuona kwanza kabla ya wengine.',                     color: 'bg-orange-50 border-orange-200' },
  video:     { label: 'Video Ads',          icon: <IcoVideo />,    iconCls: 'bg-red-100 text-red-600',       desc: 'Video ya biashara yako inaonyeshwa kwa wateja — imani na uharisi zaidi.',   color: 'bg-red-50 border-red-200' },
  bundle:    { label: 'Bundle',             icon: <IcoCube />,     iconCls: 'bg-primary-100 text-primary-600', desc: 'Mchanganyiko wa aina nyingi za matangazo kwa bei moja nzuri.',           color: 'bg-primary-50 border-primary-200' },
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
            <IcoMegaphone />
            Jukwaa la Matangazo — Tanzania
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {([
            { step: '1', icon: <IcoUserPlus />, title: 'Jiandikishe Bure', desc: 'Jaza taarifa za biashara yako. Hakuna ada ya kuanza.' },
            { step: '2', icon: <IcoClipboard />, title: 'Chagua Mpango', desc: 'Chagua aina ya tangazo na mpango unaofaa bajeti yako.' },
            { step: '3', icon: <IcoBolt />, title: 'Anza Kuonekana', desc: 'Baada ya ukaguzi wa admin, lipa na tangazo lako linaanza mara moja.' },
          ] as const).map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-primary-50 border-2 border-primary-100 rounded-2xl flex items-center justify-center text-primary-600 mb-4">
                {s.icon}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
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
          const meta = TYPE_META[type] ?? { label: type, icon: <IcoMegaphone />, iconCls: 'bg-gray-100 text-gray-500', desc: '', color: 'bg-gray-50 border-gray-200' }
          return (
            <div key={type} className="max-w-3xl mx-auto mb-10">
              <div className="flex items-center gap-3 mb-3 px-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconCls}`}>
                  {meta.icon}
                </div>
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
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-primary-500 mt-0.5 flex-shrink-0">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                            </svg>
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
            {([
              { icon: <IcoUsers />,    iconCls: 'bg-blue-50 text-blue-600',     title: 'Wateja Halisi',            desc: 'Watumizi wetu wanatafuta nyumba na huduma — hawapotezi muda.' },
              { icon: <IcoPhone />,    iconCls: 'bg-green-50 text-green-600',   title: 'Lipa kwa Simu',            desc: 'M-Pesa, Airtel Money, Tigo Pesa. Rahisi, salama, haraka.' },
              { icon: <IcoChartBar />, iconCls: 'bg-purple-50 text-purple-600', title: 'Takwimu za Wakati Halisi', desc: 'Angalia views, clicks, na wasiliano wapya kila wakati.' },
            ] as const).map(b => (
              <div key={b.title} className="flex gap-3 items-start sm:flex-col sm:items-center sm:text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${b.iconCls}`}>
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
          <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
            <IcoRocket />
          </div>
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
