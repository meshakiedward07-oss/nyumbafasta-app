'use client'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white"
        >
          ←
        </button>
        <h1 className="text-white text-lg font-bold">Masharti ya Matumizi</h1>
      </div>

      <div className="px-4 pt-5 space-y-5 max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">1. Utambulisho wa Huduma</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            NyumbaFasta ni jukwaa la Tanzania linalowezesha madalali wa nyumba na wateja kukutana.
            Huduma hii inamilikiwa na kuendeshwa na NyumbaFasta Tanzania.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">2. Matumizi Yanayoruhusiwa</h2>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Wateja wanaweza kutumia app kutafuta na kuhifadhi listings.</li>
            <li>• Madalali wanaweza kuongeza listings baada ya kununua subscription.</li>
            <li>• Kila mtumiaji anatakiwa kutoa taarifa za kweli wakati wa kusajili.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">3. Malipo</h2>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Kufungua contact ya dalali kunagharimu <strong>Tsh 2,000</strong>.</li>
            <li>• Subscription ya Basic ni <strong>Tsh 10,000/mwezi</strong> (listings 5).</li>
            <li>• Subscription ya Premium ni <strong>Tsh 25,000/mwezi</strong> (listings 20 + boost).</li>
            <li>• Malipo yote hayarudishwi baada ya huduma kutolewa.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">4. Faragha ya Data</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Tunalinda taarifa zako binafsi. Hatushirikishi data yako na watu wa nje bila idhini yako.
            Nambari ya simu ya dalali inafunuliwa kwa wateja wanaolipa tu.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">5. Maudhui</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Maudhui yote (picha, maelezo) yanayopokelewa ni ya mwenyewe wake. NyumbaFasta ina haki ya
            kuondoa maudhui yanayovunja sheria au masharti haya.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">6. Wasiliana Nasi</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Kwa maswali au malalamiko kuhusu masharti haya, wasiliana nasi:
          </p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '255665831694'}?text=${encodeURIComponent('Habari! Nina swali kuhusu Masharti ya Matumizi ya NyumbaFasta.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-3 rounded-xl text-sm font-semibold w-fit"
          >
            <span className="text-lg">💬</span>
            Wasiliana Nasi WhatsApp
          </a>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Imesasishwa: Mei 2026 · NyumbaFasta Tanzania
        </p>
      </div>
    </div>
  )
}
