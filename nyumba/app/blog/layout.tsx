import Link from 'next/link'
import Image from 'next/image'

// Lightweight server-rendered layout for the blog SEO section — same
// pattern as app/mali/layout.tsx (branded header + footer, no heavy
// client-side home shell needed for crawlable content pages).
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary-500 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2">
          <Link href="/" className="h-11 w-[180px] block relative">
            <Image
              fill
              priority
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              className="object-contain object-left"
              sizes="180px"
            />
          </Link>
          <Link
            href="/"
            className="text-white text-sm font-medium bg-white/20 px-3 py-1.5 rounded-full"
          >
            <i className="ti ti-search" aria-hidden="true" /> Tafuta Nyumba
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
