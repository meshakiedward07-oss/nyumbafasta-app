'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DataDeletionPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white flex-shrink-0"
        >
          ←
        </button>
        <div>
          <h1 className="text-white text-lg font-bold">Maombi ya Kufuta Data</h1>
          <p className="text-white/80 text-xs">Data Deletion Request</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">

        {/* Intro */}
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <p className="text-sm text-primary-800 leading-relaxed">
            NyumbaFasta inakuheshimu na faragha yako. Una haki ya kuomba tufute data yako yote
            kutoka kwenye mfumo wetu wakati wowote.
          </p>
          <p className="text-xs text-primary-700 mt-2">
            You have the right to request deletion of all your personal data from our systems at any time.
          </p>
        </div>

        {/* What data we collect — Kiswahili */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            Data Tunayokusanya
          </h2>
          <p className="text-xs text-gray-500 mb-3 italic">What data we collect</p>
          <ul className="space-y-2">
            {[
              { sw: 'Jina lako na mawasiliano (barua pepe, namba ya simu)', en: 'Your name and contact information (email, phone number)' },
              { sw: 'Historia ya mazungumzo na Amina (AI assistant)', en: 'Conversation history with Amina (AI assistant)' },
              { sw: 'Maelezo ya nyumba ulizotafuta na kuhifadhi', en: 'Property search and saved listing history' },
              { sw: 'Taarifa za malipo (bila namba za kadi — siyo tunazihifadhi)', en: 'Payment information (no card numbers stored)' },
              { sw: 'Picha ya profile uliyopakia', en: 'Profile photo you uploaded' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">{item.sw}</p>
                  <p className="text-xs text-gray-400 italic">{item.en}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* How to request */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">
            Jinsi ya Kuomba Kufutwa kwa Data
          </h2>
          <p className="text-xs text-gray-500 mb-4 italic">How to request data deletion</p>

          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="text-sm text-gray-700 font-medium">Tuma barua pepe / Send an email</p>
                <a
                  href="mailto:support@nyumbafasta.co?subject=Ombi%20la%20Kufuta%20Data%20%2F%20Data%20Deletion%20Request"
                  className="text-sm text-primary-600 font-semibold underline"
                >
                  support@nyumbafasta.co
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="text-sm text-gray-700 font-medium">Andika subject / Use this subject</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-1 font-mono">
                  Ombi la Kufuta Data / Data Deletion Request
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="text-sm text-gray-700 font-medium">Weka maelezo / Include in your message</p>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• Jina lako kamili / Your full name</li>
                  <li>• Namba ya simu uliyotumia / Phone number used</li>
                  <li>• Barua pepe ya akaunti / Account email (if any)</li>
                </ul>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                4
              </span>
              <div>
                <p className="text-sm text-gray-700 font-medium">Tungojea ombi lako / We process within</p>
                <p className="text-sm font-bold text-primary-600 mt-0.5">Siku 30 / 30 days</p>
              </div>
            </li>
          </ol>
        </div>

        {/* WhatsApp option */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Au Tumia WhatsApp</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Or contact us via WhatsApp</p>
          <a
            href="https://wa.me/255665831694?text=Ombi%20la%20Kufuta%20Data%20-%20Jina%20langu%3A%20"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#25D366] text-white px-4 py-3 rounded-xl text-sm font-semibold w-fit"
          >
            <svg className="w-5 h-5 fill-white flex-shrink-0" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.137.566 4.14 1.543 5.874L0 24l6.326-1.521A11.936 11.936 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.79 9.79 0 0 1-5.003-1.374l-.358-.213-3.754.903.958-3.65-.234-.376A9.775 9.775 0 0 1 2.182 12C2.182 6.575 6.575 2.182 12 2.182S21.818 6.575 21.818 12 17.425 21.818 12 21.818z"/>
            </svg>
            Omba kufuta data (WhatsApp)
          </a>
        </div>

        {/* Timeline & confirmation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Mchakato wa Kufuta</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Deletion process &amp; confirmation</p>
          <div className="space-y-3">
            {[
              { days: '1–3', sw: 'Tutakuthibitishia kupokea ombi lako', en: 'We confirm receipt of your request' },
              { days: '7–14', sw: 'Data yako inafutwa kutoka kwenye mifumo yote', en: 'Your data is deleted from all our systems' },
              { days: '30', sw: 'Utapata barua pepe ya uthibitisho wa kufutwa', en: 'You receive a final deletion confirmation email' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg flex-shrink-0 min-w-[50px] text-center">
                  Siku {step.days}
                </span>
                <div>
                  <p className="text-sm text-gray-700">{step.sw}</p>
                  <p className="text-xs text-gray-400 italic">{step.en}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Kumbuka:</strong> Kufuta akaunti yako kutafuta data yote ya kibinafsi. Taarifa za
            malipo zinaweza kuhifadhiwa kwa miezi 7 kwa madhumuni ya kisheria na kodi.
          </p>
          <p className="text-xs text-amber-700 mt-1 italic">
            Note: Deletion removes all personal data. Payment records may be retained for 7 months for legal and tax purposes.
          </p>
        </div>

        {/* Links */}
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/privacy"
            className="text-sm text-primary-600 underline"
          >
            Sera ya Faragha
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/terms"
            className="text-sm text-primary-600 underline"
          >
            Masharti ya Matumizi
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Imesasishwa: Juni 2026 · NyumbaFasta Tanzania
        </p>
      </div>
    </div>
  )
}
