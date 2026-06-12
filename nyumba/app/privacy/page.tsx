'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
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
          <h1 className="text-white text-lg font-bold">Sera ya Faragha</h1>
          <p className="text-white/80 text-xs">Privacy Policy</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">1. Data Tunayokusanya</h2>
          <p className="text-xs text-gray-500 mb-3 italic">What data we collect</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Jina, barua pepe, na namba ya simu</li>
            <li>• Picha ya profile (kama unapakia)</li>
            <li>• Historia ya kutafuta na kuhifadhi nyumba</li>
            <li>• Mazungumzo na Amina (AI assistant)</li>
            <li>• Taarifa za malipo bila namba za kadi</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">2. Jinsi Tunavyotumia Data</h2>
          <p className="text-xs text-gray-500 mb-3 italic">How we use your data</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Kutoa huduma ya kutafuta nyumba na dalali</li>
            <li>• Kuboresha uzoefu wako ndani ya app</li>
            <li>• Kukusaidia kupitia Amina AI assistant</li>
            <li>• Kutuma arifa muhimu za akaunti yako</li>
            <li>• Kuzuia ulaghai na kulinda usalama wa mfumo</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">3. Ushirikiano wa Data</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Data sharing</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Hatushirikishi data yako ya kibinafsi na watu wa nje isipokuwa:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed mt-2">
            <li>• Dalali — namba yake ya simu inafunuliwa kwa wateja wanaolipa tu</li>
            <li>• Watoa huduma wa malipo (Selcom, AzamPay) kwa usindikaji wa malipo</li>
            <li>• Mamlaka za kisheria iwapo inahitajika kwa sheria</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">4. Usalama wa Data</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Data security</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Tunatumia usimbaji fiche (encryption) wa kiwango cha juu kulinda data yako.
            Data zote huhifadhiwa kwenye seva salama za Supabase (EU region).
            Namba za kadi za benki hazijalindwa — hatuzihifadhi kabisa.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">5. Haki Zako</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Your rights</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• <strong>Kufikia:</strong> Unaweza kuomba nakala ya data yako yote</li>
            <li>• <strong>Kusahihisha:</strong> Unaweza kusasisha taarifa zako zisizo sahihi</li>
            <li>• <strong>Kufuta:</strong> Unaweza kuomba tufute data yako yote</li>
            <li>• <strong>Kupinga:</strong> Unaweza kupinga usindikaji fulani wa data yako</li>
          </ul>
        </div>

        {/* Data Deletion CTA — prominent link for Meta compliance */}
        <div className="bg-primary-50 border-2 border-primary-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🗑️</span>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-primary-900 mb-1">
                Omba Kufutwa kwa Data Yako
              </h2>
              <p className="text-xs text-primary-700 italic mb-3">
                Request deletion of your personal data
              </p>
              <p className="text-sm text-primary-800 mb-4 leading-relaxed">
                Una haki ya kuomba tufute data yako yote. Tutashughulikia ombi lako ndani ya siku 30.
              </p>
              <Link
                href="/data-deletion"
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                Omba Kufuta Data →
              </Link>
              <p className="text-xs text-primary-600 mt-2">
                nyumbafasta.co/data-deletion
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">6. Wasiliana Nasi</h2>
          <p className="text-xs text-gray-500 mb-3 italic">Contact us</p>
          <p className="text-sm text-gray-600 mb-3">
            Kwa maswali yoyote kuhusu faragha yako:
          </p>
          <div className="space-y-2">
            <a
              href="mailto:support@nyumbafasta.co"
              className="flex items-center gap-2 text-sm text-primary-600"
            >
              <span>✉️</span> support@nyumbafasta.co
            </a>
            <a
              href="https://wa.me/255665831694"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600"
            >
              <span>💬</span> WhatsApp: +255 665 831 694
            </a>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href="/data-deletion" className="text-sm text-primary-600 underline">
            Kufuta Data
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/terms" className="text-sm text-primary-600 underline">
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
