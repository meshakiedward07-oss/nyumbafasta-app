import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = { title: 'NyumbaFasta Advertising' }

export default function AdvertisingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="NyumbaFasta" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-primary-700 text-lg">NyumbaFasta</span>
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500 font-medium">Biashara na Matangazo</span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/advertising/dashboard"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Dashibodi yangu
          </Link>
          <Link
            href="/advertising/new"
            className="bg-primary-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-primary-600 transition font-medium"
          >
            + Tangazo Jipya
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 bg-white">
        © 2024 NyumbaFasta Tanzania · <Link href="/privacy" className="hover:underline">Sera ya Faragha</Link>
      </footer>
    </div>
  )
}
