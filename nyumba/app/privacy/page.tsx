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

        <p className="text-xs text-gray-400 text-center">
          Last updated: June 2026 · Effective immediately
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm text-blue-800 leading-relaxed">
            NyumbaFasta ("we", "us", "our") is committed to protecting your personal information.
            This Privacy Policy explains what data we collect, how we use it, and your rights.
            It applies to all users of <strong>nyumbafasta.co</strong> and our mobile application.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">1. Data We Collect</h2>
          <p className="text-xs text-gray-500 italic mb-3">Data Tunayokusanya</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• Full name, email address, and phone number (provided at registration)</li>
            <li>• Profile photo (if uploaded)</li>
            <li>• Property listing content: photos, videos, descriptions, location</li>
            <li>• Search history and saved listings</li>
            <li>• Conversation history with Amina (our AI assistant)</li>
            <li>• Payment transaction records (amount, date, method) — no card numbers stored</li>
            <li>• Device type, browser, and general location for analytics</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">2. How We Use Your Data</h2>
          <p className="text-xs text-gray-500 italic mb-3">Jinsi Tunavyotumia Data</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• To provide and improve the NyumbaFasta service</li>
            <li>• To connect property seekers with agents (madalali)</li>
            <li>• To process payments and manage subscriptions</li>
            <li>• To power Amina, our AI assistant chatbot</li>
            <li>• To send you important account notifications</li>
            <li>• To detect fraud and protect the security of the platform</li>
            <li>• To publish property listings on our official social media accounts (admin only)</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">3. Third-Party Platform Integrations</h2>
          <p className="text-xs text-gray-500 italic mb-3">Ushirikiano na Mifumo ya Nje</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            NyumbaFasta integrates with the following third-party APIs to publish property listings
            on our official social media accounts. These integrations are used by NyumbaFasta admins
            only — <strong>no end-user personal data is transmitted to these platforms</strong>.
          </p>

          {/* TikTok */}
          <div className="border border-gray-100 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-brand-tiktok text-lg" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">TikTok API</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1.5 leading-relaxed">
              <li>• <strong>Purpose:</strong> Post property listing videos and Stories to the official NyumbaFasta TikTok business account</li>
              <li>• <strong>Data accessed:</strong> Our own TikTok Business account credentials only. No user data is read or written.</li>
              <li>• <strong>Data shared with TikTok:</strong> Video files and captions created by NyumbaFasta admins for our listings</li>
              <li>• <strong>User data shared:</strong> None. End-user names, phones, or payment info are never sent to TikTok.</li>
              <li>• <strong>Scopes used:</strong> <code className="bg-gray-100 px-1 rounded text-xs">video.publish</code>, <code className="bg-gray-100 px-1 rounded text-xs">video.upload</code></li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">
              TikTok's Privacy Policy: <a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">tiktok.com/legal/privacy-policy</a>
            </p>
          </div>

          {/* Instagram / Meta */}
          <div className="border border-gray-100 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-brand-instagram text-lg" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">Instagram Graph API (Meta)</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1.5 leading-relaxed">
              <li>• <strong>Purpose:</strong> Post listing photos, videos, Reels, and Stories to the official NyumbaFasta Instagram Business account</li>
              <li>• <strong>Data accessed:</strong> Our own Instagram Business account only</li>
              <li>• <strong>User data shared:</strong> None</li>
            </ul>
          </div>

          {/* Facebook */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-brand-facebook text-lg" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">Facebook Graph API (Meta)</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1.5 leading-relaxed">
              <li>• <strong>Purpose:</strong> Post property listings to NyumbaFasta's Facebook Page and groups</li>
              <li>• <strong>Data accessed:</strong> Our own Facebook Page and linked catalog</li>
              <li>• <strong>User data shared:</strong> None</li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">4. Data Sharing</h2>
          <p className="text-xs text-gray-500 italic mb-3">Ushirikiano wa Data</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We do not sell or share your personal data with third parties except:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed mt-2">
            <li>• <strong>Property agent (dalali):</strong> Phone number is only disclosed to clients who have completed payment (Tsh 2,000)</li>
            <li>• <strong>Payment processors:</strong> Selcom / AzamPay process mobile money payments securely</li>
            <li>• <strong>Cloud infrastructure:</strong> Supabase (database, EU region), Cloudinary (media storage), Vercel (hosting)</li>
            <li>• <strong>Legal requirement:</strong> If required by Tanzanian law or court order</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">5. Data Security</h2>
          <p className="text-xs text-gray-500 italic mb-3">Usalama wa Data</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We use industry-standard encryption (TLS/HTTPS) for all data in transit.
            Data is stored on Supabase secure servers with Row-Level Security (RLS) policies.
            We never store payment card numbers — mobile money transactions are handled by
            licensed third-party processors.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">6. Data Retention</h2>
          <p className="text-xs text-gray-500 italic mb-3">Muda wa Kuhifadhi Data</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We retain your data for as long as your account is active. If you request deletion,
            we will permanently remove your personal data within 30 days, except where retention
            is required by law (e.g., financial transaction records).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">7. Your Rights</h2>
          <p className="text-xs text-gray-500 italic mb-3">Haki Zako</p>
          <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
            <li>• <strong>Access:</strong> Request a copy of all data we hold about you</li>
            <li>• <strong>Correction:</strong> Update inaccurate information in your profile</li>
            <li>• <strong>Deletion:</strong> Request permanent deletion of your account and data</li>
            <li>• <strong>Objection:</strong> Object to specific processing of your data</li>
            <li>• <strong>Portability:</strong> Receive your data in a machine-readable format</li>
          </ul>
        </div>

        {/* Data Deletion CTA */}
        <div className="bg-primary-50 border-2 border-primary-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <i className="ti ti-trash text-2xl" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-sm font-bold text-primary-900 mb-1">
                Request Deletion of Your Data
              </h2>
              <p className="text-xs text-primary-700 italic mb-3">
                Omba Kufutwa kwa Data Yako
              </p>
              <p className="text-sm text-primary-800 mb-4 leading-relaxed">
                You have the right to request that we delete all your personal data.
                We will action your request within 30 days.
              </p>
              <Link
                href="/data-deletion"
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                Request Data Deletion →
              </Link>
              <p className="text-xs text-primary-600 mt-2">
                nyumbafasta.co/data-deletion
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">8. Cookies & Analytics</h2>
          <p className="text-xs text-gray-500 italic mb-3">Vidakuzi na Takwimu</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We use Google Analytics and Vercel Analytics to understand how users interact with the
            platform. These collect anonymised usage data (page views, session duration).
            No personally identifiable information is sent to analytics providers.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">9. Changes to This Policy</h2>
          <p className="text-xs text-gray-500 italic mb-3">Mabadiliko ya Sera Hii</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify registered users
            of material changes via email or in-app notification. Continued use of NyumbaFasta
            after changes constitutes acceptance of the updated Policy.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-1">10. Contact Us</h2>
          <p className="text-xs text-gray-500 italic mb-3">Wasiliana Nasi</p>
          <p className="text-sm text-gray-600 mb-3">
            For any privacy-related questions or to exercise your rights, contact:
          </p>
          <div className="space-y-2">
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
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/terms" className="text-sm text-primary-600 underline">
            Terms of Service
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
          © 2026 NyumbaFasta Tanzania · nyumbafasta.co/privacy
        </p>
      </div>
    </div>
  )
}
