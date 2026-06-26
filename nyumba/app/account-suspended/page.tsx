'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { supportWaUrl } from '@/lib/config/support'

export default function AccountSuspendedPage() {
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
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">⏸️</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Akaunti Imesimamishwa
        </h1>

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 my-5 text-left space-y-2">
          <p className="text-sm text-orange-800 font-medium">Sababu inayowezekana:</p>
          <ul className="text-xs text-orange-700 space-y-1.5 list-disc list-inside">
            <li>Malalamiko yaliyopokelewa kutoka kwa watumiaji wengine</li>
            <li>Ukiukaji wa masharti ya matumizi ya NyumbaFasta</li>
            <li>Shughuli ya kutia shaka (taarifa za uongo, spam, n.k.)</li>
          </ul>
        </div>

        <p className="text-xs text-gray-500 mb-6">
          Kama unaamini hii ni kosa, wasiliana nasi kupitia WhatsApp ili tushughulikie hali yako haraka.
        </p>

        {/* WhatsApp support */}
        <a
          href={supportWaUrl('Habari, akaunti yangu ya NyumbaFasta imesimamishwa. Nataka kujua sababu na jinsi ya kuirudisha.')}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#25D366] text-white py-3.5 rounded-xl text-sm font-semibold mb-3 hover:bg-[#20b857] transition-colors"
        >
          📱 Wasiliana WhatsApp
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
