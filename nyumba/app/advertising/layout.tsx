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
          <Image src="/logo-light.svg" alt="NyumbaFasta" width={140} height={56} priority />
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
