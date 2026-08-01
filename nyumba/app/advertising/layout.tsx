import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/ads/LogoutButton'

export const metadata = { title: 'NyumbaFasta · Matangazo ya Biashara' }

export default async function AdvertisingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 sticky top-0 z-50">
        <Link href="/" className="flex items-center mr-2">
          <div className="relative h-10 w-36">
            <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority sizes="144px" className="object-contain object-left" />
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
                href="/advertising/messages"
                className="text-sm text-gray-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition hidden sm:inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Ujumbe
              </Link>
              <Link
                href="/advertising/new"
                className="bg-primary-500 text-white text-sm px-3 py-1.5 rounded-xl hover:bg-primary-600 transition font-bold"
              >
                <span className="hidden sm:inline">+ Tangazo Jipya</span>
                <span className="sm:hidden">+</span>
              </Link>
              <LogoutButton />
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

    </div>
  )
}
