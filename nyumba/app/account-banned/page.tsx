'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { supportWaUrl } from '@/lib/config/support'

export default function AccountBannedPage() {
  const supabase = createClient()
  const router   = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">

        {/* Icon */}
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <i className="ti ti-ban text-4xl text-red-500" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Akaunti Imefutwa
        </h1>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-5 text-left space-y-2">
          <p className="text-sm text-red-800 font-medium">Akaunti yako imefutwa kwa sababu ya:</p>
          <ul className="text-xs text-red-700 space-y-1.5 list-disc list-inside">
            <li>Ukiukaji mkubwa wa masharti ya matumizi</li>
            <li>Ulaghai au udanganyifu uliothibitishwa</li>
            <li>Malalamiko mengi yaliyothibitishwa</li>
            <li>Vitendo vya uhalifu vinavyohusiana na jukwaa</li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
          <p className="text-xs text-gray-600">
            Uamuzi huu ni wa mwisho na umefanywa baada ya uchunguzi wa kina.
            Kufungua akaunti mpya kwa kutumia jina lingine pia ni ukiukaji wa masharti yetu.
          </p>
        </div>

        {/* Contact for appeal */}
        <a
          href={supportWaUrl('Habari, akaunti yangu ya NyumbaFasta imefutwa. Nataka kuomba rufaa ya uamuzi huu.')}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-gray-800 text-white py-3.5 rounded-xl text-sm font-semibold mb-3 hover:bg-gray-700 transition-colors"
        >
          <i className="ti ti-pencil" aria-hidden="true" /> Omba Rufaa (Appeal)
        </a>

        <button
          onClick={handleSignOut}
          className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Toka / Sign Out
        </button>

        <p className="text-[10px] text-gray-400 mt-4">
          NyumbaFasta · support@nyumbafasta.co
        </p>
      </div>
    </div>
  )
}
