'use client'
import Link from 'next/link'
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
        <div>
          <h1 className="text-white text-lg font-bold">Masharti ya Matumizi</h1>
          <p className="text-white/80 text-xs">Terms of Service</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5 max-w-2xl mx-auto">

        {/* Last updated */}
        <p className="text-xs text-gray-400 text-center">
          Last updated: June 2026 · Effective immediately
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">1. Service Description</h2>
          <p className="text-xs text-gray-500 italic mb-3">Utambulisho wa Huduma</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            NyumbaFasta is a Tanzania-based real estate marketplace platform that connects property
            agents (madalali) with clients looking for rental housing. The service is owned and
            operated by NyumbaFasta Tanzania.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            NyumbaFasta ni jukwaa la Tanzania linalowezesha madalali wa nyumba na wateja kukutana.
            Huduma hii inamilikiwa na kuendeshwa na NyumbaFasta Tanzania.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">2. Permitted Use</h2>
          <p className="text-xs text-gray-500 italic mb-3">Matumizi Yanayoruhusiwa</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Clients may use the app to search for and save property listings.</li>
            <li>• Property agents (madalali) may post listings after purchasing a subscription.</li>
            <li>• All users must provide accurate information during registration.</li>
            <li>• You must be at least 18 years old to use this platform.</li>
            <li>• Commercial scraping or automated access is not permitted without written consent.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">3. Payments & Fees</h2>
          <p className="text-xs text-gray-500 italic mb-3">Malipo</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Unlocking a dalali&apos;s contact costs <strong>Tsh 2,000</strong> per listing.</li>
            <li>• Basic subscription is <strong>Tsh 10,000/month</strong> (up to 5 listings).</li>
            <li>• Premium subscription is <strong>Tsh 25,000/month</strong> (up to 20 listings + boost + verified badge).</li>
            <li>• All payments are processed via Selcom (M-Pesa, Airtel Money, Tigo Pesa).</li>
            <li>• Payments are non-refundable once the service has been delivered.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">4. User Content</h2>
          <p className="text-xs text-gray-500 italic mb-3">Maudhui ya Watumiaji</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            All content submitted (photos, descriptions, videos) remains the intellectual property
            of the user who uploaded it. By posting content you grant NyumbaFasta a non-exclusive
            licence to display it on the platform and associated social media channels.
            NyumbaFasta reserves the right to remove content that violates these Terms or applicable law.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">5. Social Media Integration</h2>
          <p className="text-xs text-gray-500 italic mb-3">Ushirikiano wa Mitandao ya Kijamii</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">
            NyumbaFasta uses the following third-party platform APIs to publish property listings
            on behalf of authorised administrators only:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• <strong>TikTok API</strong> — used to post listing videos and Stories to the official NyumbaFasta TikTok account. Only admin-initiated posts are made; no user data is sent to TikTok without explicit consent.</li>
            <li>• <strong>Instagram Graph API</strong> — used to post listing photos, videos, Reels and Stories to the official NyumbaFasta Instagram account.</li>
            <li>• <strong>Facebook Graph API</strong> — used to post listings to the official NyumbaFasta Facebook Page and relevant groups.</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            These integrations are used exclusively for marketing the platform&apos;s own listings.
            User personal data (names, phone numbers, payment details) is never shared with these
            social media platforms.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">6. Data Privacy</h2>
          <p className="text-xs text-gray-500 italic mb-3">Faragha ya Data</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We protect your personal information and do not share it with third parties without your
            consent. A dalali&apos;s phone number is only revealed to clients who have completed payment.
            See our full <Link href="/privacy" className="text-primary-600 underline">Privacy Policy</Link> for details.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">7. Account Termination</h2>
          <p className="text-xs text-gray-500 italic mb-3">Kufuta Akaunti</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            NyumbaFasta reserves the right to suspend or terminate accounts that violate these Terms,
            engage in fraudulent activity, or post misleading listings. Users may request deletion of
            their account and data at any time via the <Link href="/data-deletion" className="text-primary-600 underline">Data Deletion</Link> page.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">8. Limitation of Liability</h2>
          <p className="text-xs text-gray-500 italic mb-3">Mipaka ya Wajibu</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            NyumbaFasta acts as a marketplace platform and is not responsible for the accuracy of
            listings posted by agents. We do not guarantee property availability. Disputes between
            clients and agents should be resolved directly between the parties.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">9. Governing Law</h2>
          <p className="text-xs text-gray-500 italic mb-3">Sheria Inayotawala</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            These Terms are governed by the laws of the United Republic of Tanzania.
            Any disputes shall be subject to the jurisdiction of Tanzanian courts.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">10. Contact Us</h2>
          <p className="text-xs text-gray-500 italic mb-3">Wasiliana Nasi</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            For questions or complaints about these Terms, contact us:
          </p>
          <div className="space-y-2 mb-4">
            <a
              href="mailto:support@nyumbafasta.co"
              className="flex items-center gap-2 text-sm text-primary-600"
            >
              <i className="ti ti-mail" aria-hidden="true" /> support@nyumbafasta.co
            </a>
            <a
              href="https://wa.me/255665831694"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600"
            >
              <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp: +255 665 831 694
            </a>
          </div>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '255665831694'}?text=${encodeURIComponent('Habari! Nina swali kuhusu Masharti ya Matumizi ya NyumbaFasta.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-3 rounded-xl text-sm font-semibold w-fit"
          >
            <i className="ti ti-brand-whatsapp text-lg" aria-hidden="true" />
            Chat on WhatsApp
          </a>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/privacy" className="text-sm text-primary-600 underline">
            Privacy Policy
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/data-deletion" className="text-sm text-primary-600 underline">
            Data Deletion
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/" className="text-sm text-primary-600 underline">
            Home
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          © 2026 NyumbaFasta Tanzania · nyumbafasta.co/terms
        </p>
      </div>
    </div>
  )
}
