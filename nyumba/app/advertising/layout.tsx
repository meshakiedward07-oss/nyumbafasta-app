import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'NyumbaFasta · Matangazo ya Biashara' }

export default async function AdvertisingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 mr-2">
          <Image src="/logo.png" alt="NyumbaFasta" width={30} height={30} className="rounded-lg" />
          <div>
            <span className="font-bold text-primary-700 text-base leading-none">NyumbaFasta</span>
            <span className="block text-[10px] text-gray-400 leading-none">Matangazo</span>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/advertising/dashboard"
                className="text-sm text-gray-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition hidden sm:inline-flex"
              >
                Dashibodi
              </Link>
              <Link
                href="/advertising/new"
                className="bg-primary-500 text-white text-sm px-3 py-1.5 rounded-xl hover:bg-primary-600 transition font-bold"
              >
                <span className="hidden sm:inline">+ Tangazo Jipya</span>
                <span className="sm:hidden">+</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/advertising/login"
                className="text-sm text-gray-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                Ingia
              </Link>
              <Link
                href="/advertising/register"
                className="bg-primary-500 text-white text-sm px-3 py-1.5 rounded-xl hover:bg-primary-600 transition font-bold"
              >
                Jisajili Bure
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 bg-white px-4">
        <p>© 2024 NyumbaFasta Tanzania</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/privacy" className="hover:underline">Sera ya Faragha</Link>
          <Link href="/advertising" className="hover:underline">Matangazo</Link>
          <Link href="/" className="hover:underline">Nyumbani</Link>
        </div>
      </footer>
    </div>
  )
}
