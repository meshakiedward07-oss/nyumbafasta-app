'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ResendEmailButton from '@/components/auth/ResendEmailButton'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-sm">

        <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-mail text-4xl text-primary-500" aria-hidden="true" />
        </div>

        <h2 className="font-bold text-xl text-gray-800 mb-2">Thibitisha Barua Pepe Yako</h2>

        <p className="text-gray-500 text-sm mb-1">
          Unahitaji kuthibitisha barua pepe yako ili kuendelea.
        </p>
        {email && (
          <p className="font-semibold text-gray-800 mb-5">{email}</p>
        )}

        <div className="bg-primary-50 rounded-xl p-4 mb-5 text-left">
          <p className="text-primary-800 text-sm font-medium mb-3">Hatua za kufuata:</p>
          <div className="space-y-2.5">
            {[
              'Fungua Gmail au email yako',
              'Tafuta email kutoka NyumbaFasta',
              'Bonyeza "Thibitisha Akaunti Yangu"',
            ].map((txt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-primary-800 text-xs">{txt}</p>
              </div>
            ))}
          </div>
        </div>

        {email && <ResendEmailButton email={email} />}

        <p className="text-gray-400 text-xs mt-4">
          Angalia spam/junk folder kama email haionekani
        </p>

        <button
          onClick={() => router.push('/login')}
          className="mt-4 text-primary-500 text-sm underline"
        >
          Rudi Login →
        </button>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
