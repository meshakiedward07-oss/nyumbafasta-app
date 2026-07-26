import Link from 'next/link'

const PAGES: Record<string, { title: string; icon: string; phase: number; desc: string }> = {
  mali:        { title: 'Mali Zangu',          icon: 'building',    phase: 2, desc: 'Angalia na simamia nyumba na vitengo vyako vya kukodisha.' },
  wapangaji:   { title: 'Wapangaji',           icon: 'users',       phase: 2, desc: 'Simamia wapangaji, mikataba ya upangaji, na historia.' },
  maintenance: { title: 'Matengenezo',         icon: 'tool',        phase: 4, desc: 'Pokea na fuatilia maombi ya matengenezo na mafundi.' },
  hati:        { title: 'Hati na Nyaraka',     icon: 'folder',      phase: 2, desc: 'Hifadhi hati zote za mali, mikataba, na leseni.' },
  taarifa:     { title: 'Taarifa na Takwimu',  icon: 'chart-bar',   phase: 9, desc: 'Angalia uchambuzi wa mapato, matumizi, na mwenendo.' },
  mipangilio:  { title: 'Mipangilio ya Shirika', icon: 'settings',  phase: 1, desc: 'Badilisha taarifa za shirika lako na mipangilio ya akaunti.' },
}

export default function PlaceholderPage() {
  const path = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() ?? '' : ''
  const page = PAGES[path] ?? { title: 'Ukurasa huu', icon: 'clock', phase: 2, desc: 'Kipengele hiki kinakuja hivi karibuni.' }
  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className={`ti ti-${page.icon} text-3xl text-gray-300`} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{page.title}</h1>
        <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">{page.desc}</p>
        <span className="inline-block text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full font-medium">
          Inakuja — Awamu {page.phase}
        </span>
        <div className="mt-6">
          <Link href="/property/dashboard">
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              ← Rudi Dashibodini
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
