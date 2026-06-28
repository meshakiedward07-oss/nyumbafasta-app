import Link from 'next/link'

// Lightweight server-rendered layout for SEO landing pages.
// Keeps a branded header + footer so these pages are fully usable and
// crawlable without pulling in the heavy client-side home shell.
export default function MaliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary-500 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
          <Link href="/" className="h-11 w-[180px] block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              className="h-full w-full object-contain object-left"
            />
          </Link>
          <Link
            href="/"
            className="text-white text-sm font-medium bg-white/20 px-3 py-1.5 rounded-full"
          >
            <i className="ti ti-search" aria-hidden="true" /> Tafuta
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-gray-100 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>© {new Date().getFullYear()} NyumbaFasta — Pata Nyumba Haraka Tanzania</p>
        </div>
      </footer>
    </div>
  )
}
