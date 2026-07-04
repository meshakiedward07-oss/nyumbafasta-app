import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header strip */}
      <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center">
        <div className="relative h-16 w-40">
          <Image
            src="/transparent_logo_nyumbafasta.png"
            alt="NyumbaFasta"
            fill
            priority
            className="object-contain"
            sizes="160px"
          />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">

        {/* House icon illustration */}
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full bg-primary-50 flex items-center justify-center">
            <i className="ti ti-home-off text-5xl text-primary-400" aria-hidden="true" />
          </div>
          <div className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm leading-none">404</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Ukurasa Haukupatikana
        </h1>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-8">
          Ukurasa huu haupo au ulihamia mahali pengine.
          Rudi nyumbani kupata nyumba nzuri Tanzania.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/"
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl font-semibold text-sm
                       flex items-center justify-center gap-2
                       active:scale-[0.97] transition-transform"
          >
            <i className="ti ti-home text-base" aria-hidden="true" />
            Rudi Nyumbani
          </Link>
          <Link
            href="/mali/dar-es-salaam"
            className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl
                       font-semibold text-sm flex items-center justify-center gap-2
                       active:scale-[0.97] transition-transform"
          >
            <i className="ti ti-map-pin text-base text-primary-500" aria-hidden="true" />
            Tafuta Dar es Salaam
          </Link>
        </div>

        {/* Quick region links */}
        <div className="mt-8 w-full max-w-xs">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">
            Mikoa Maarufu
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Arusha', 'Mwanza', 'Zanzibar Mjini Magharibi', 'Dodoma', 'Kilimanjaro', 'Mbeya'].map(region => (
              <Link
                key={region}
                href={`/mali/${region.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-xs text-primary-600 bg-primary-50 border border-primary-100
                           px-3 py-1.5 rounded-full font-medium
                           hover:bg-primary-100 transition-colors"
              >
                {region}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 text-center">
        <p className="text-xs text-gray-400">
          © 2026 NyumbaFasta Tanzania
        </p>
      </div>
    </div>
  )
}
