import Link from 'next/link'
import Image from 'next/image'

const PORTAL_ROLES = [
  {
    key:        'org',
    icon:       'building-estate',
    label:      'Shirika / Mmiliki / PM',
    sub:        'Simamia mali yako — wapangaji, malipo ya kodi, na matengenezo mahali pamoja.',
    color:      '#7C3AED',
    bg:         '#F5F3FF',
    loginHref:  '/portal/login?type=org',
    registerHref: '/register?role=org_owner',
    features:   ['Dashibodi ya mali yako', 'Malipo ya kodi', 'Mafundi & matengenezo', 'Ripoti na takwimu'],
  },
  {
    key:        'tenant',
    icon:       'key',
    label:      'Mpangaji',
    sub:        'Angalia malipo yako ya kodi, toa ushahidi wa malipo, na ripoti matatizo ya nyumba.',
    color:      '#D97706',
    bg:         '#FFFBEB',
    loginHref:  '/portal/login?type=tenant',
    registerHref: '/register?role=tenant',
    features:   ['Malipo ya kodi', 'Historia ya malipo', 'Ripoti matatizo'],
  },
  {
    key:        'fundi',
    icon:       'tools',
    label:      'Fundi / Mchezaji',
    sub:        'Pokea kazi kutoka mashirika, toa taarifa za kazi, na simamia wasifu wako.',
    color:      '#059669',
    bg:         '#ECFDF5',
    loginHref:  '/fundi/login',
    registerHref: '/fundi/register',
    features:   ['Orodha ya kazi', 'Toa taarifa za kazi', 'Wasifu & KYC'],
  },
]

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-12 pb-10 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(160deg, #27AE72 0%, #1D9E75 55%, #117652 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative h-16 w-44 mb-4">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="176px" />
        </div>
        <h1 className="text-white text-xl font-bold mt-1">Portal ya Usimamizi</h1>
        <p className="text-white/75 text-sm mt-1">Chagua aina ya akaunti yako ili kuendelea</p>
      </div>

      {/* Role cards */}
      <div className="flex-1 px-4 pt-6 pb-10 max-w-lg mx-auto w-full space-y-4">
        {PORTAL_ROLES.map(p => (
          <div key={p.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-4 p-5 border-b border-gray-50">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: p.bg }}>
                <i className={`ti ti-${p.icon} text-2xl`} style={{ color: p.color }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 text-base leading-tight">{p.label}</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.sub}</p>
              </div>
            </div>

            {/* Features */}
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-50">
              {p.features.map(f => (
                <span key={f} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full"
                  style={{ background: p.bg, color: p.color }}>
                  <i className="ti ti-circle-check text-[10px]" aria-hidden="true" /> {f}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex gap-2">
              <Link href={p.loginHref}
                className="flex-1 flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-xl transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: p.color }}>
                <i className="ti ti-login text-sm" aria-hidden="true" /> Ingia
              </Link>
              <Link href={p.registerHref}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl border-2 transition hover:bg-gray-50 active:scale-[0.98]"
                style={{ borderColor: p.color, color: p.color }}>
                <i className="ti ti-user-plus text-sm" aria-hidden="true" /> Jisajili
              </Link>
            </div>
          </div>
        ))}

        {/* Marketplace link */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-home-search text-primary-600 text-xl" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">Soko la Nyumba</p>
            <p className="text-xs text-gray-500">Tafuta nyumba au dalali</p>
          </div>
          <Link href="/login" className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1 flex-shrink-0">
            Ingia <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 pb-2">
          NyumbaFasta · Msaada:{' '}
          <a href="https://wa.me/255665831694" className="underline text-green-600">WhatsApp</a>
        </p>
      </div>
    </div>
  )
}
