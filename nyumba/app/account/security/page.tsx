'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Factor = { id: string; status: 'verified' | 'unverified'; friendly_name?: string }
type EnrollState = { qr: string; secret: string; factorId: string } | null

export default function SecurityPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [factors,       setFactors]       = useState<Factor[]>([])
  const [loading,       setLoading]       = useState(true)
  const [enrolling,     setEnrolling]     = useState(false)
  const [enrollData,    setEnrollData]    = useState<EnrollState>(null)
  const [verifyCode,    setVerifyCode]    = useState('')
  const [verifying,     setVerifying]     = useState(false)
  const [unenrolling,   setUnenrolling]   = useState(false)
  const [showUnenroll,  setShowUnenroll]  = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')

  useEffect(() => { loadFactors() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFactors() {
    setLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors((data?.totp ?? []) as Factor[])
    setLoading(false)
  }

  async function startEnroll() {
    setError('')
    setEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NyumbaFasta' })
    if (error || !data) {
      setError(error?.message ?? 'Imeshindwa kuanzisha usajili wa 2FA')
      setEnrolling(false)
      return
    }
    setEnrollData({ qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id })
    setEnrolling(false)
  }

  async function confirmEnroll() {
    if (!enrollData || verifyCode.length !== 6) return
    setVerifying(true)
    setError('')
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId })
      if (cErr || !challenge) throw new Error(cErr?.message ?? 'Imeshindwa')

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId:    enrollData.factorId,
        challengeId: challenge.id,
        code:        verifyCode.trim(),
      })
      if (vErr) throw new Error('Nambari si sahihi. Angalia app yako.')

      setEnrollData(null)
      setVerifyCode('')
      setSuccess('2FA imewezeshwa! Akaunti yako iko salama zaidi sasa.')
      await loadFactors()
      setTimeout(() => setSuccess(''), 6000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnroll() {
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }).catch(() => {})
    }
    setEnrollData(null)
    setVerifyCode('')
    setError('')
  }

  async function handleUnenroll() {
    const factor = factors[0]
    if (!factor) return
    setUnenrolling(true)
    setError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (error) {
      setError('Imeshindwa kuondoa 2FA. Jaribu tena.')
    } else {
      setSuccess('2FA imeondolewa.')
      await loadFactors()
      setTimeout(() => setSuccess(''), 5000)
    }
    setShowUnenroll(false)
    setUnenrolling(false)
  }

  const has2FA = factors.some(f => f.status === 'verified')

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-7">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()}
            aria-label="Rudi nyuma"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 text-white text-lg">
            ←
          </button>
          <h1 className="text-white text-lg font-bold">Usalama wa Akaunti</h1>
        </div>
      </div>

      <div className="px-4 pt-5 max-w-md mx-auto space-y-4">
        {success && (
          <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <i className="ti ti-circle-check" aria-hidden="true" /> {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Password change */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nenosiri</p>
          </div>
          <button
            onClick={() => router.push('/account/change-password')}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 text-left"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ti ti-lock text-gray-500 text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Badilisha Nenosiri</p>
              <p className="text-xs text-gray-400">Unda nenosiri jipya salama</p>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </button>
        </div>

        {/* 2FA card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Uthibitisho wa Hatua Mbili (2FA)</p>
            {!loading && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${has2FA ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {has2FA ? 'Imewezeshwa' : 'Imezimwa'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="px-4 py-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : enrollData ? (
            /* ── Enrollment flow ── */
            <div className="px-4 py-5 space-y-4">
              <p className="text-sm text-gray-700 font-medium">Hatua 1: Scan QR Code</p>
              <p className="text-xs text-gray-500">
                Fungua app yako ya uthibitisho (Google Authenticator, Authy, au Microsoft Authenticator) kisha scan QR code hii.
              </p>
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white border border-gray-200 rounded-xl p-3 inline-block">
                  <Image src={enrollData.qr} alt="QR Code ya 2FA" width={180} height={180} className="rounded-lg" unoptimized />
                </div>
              </div>
              {/* Manual secret */}
              <details className="text-xs">
                <summary className="text-primary-600 cursor-pointer hover:underline">Haiwezi kuscan? Weka manually</summary>
                <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 font-mono text-gray-700 break-all select-all text-center border border-gray-200">
                  {enrollData.secret}
                </div>
              </details>

              <p className="text-sm text-gray-700 font-medium mt-2">Hatua 2: Thibitisha</p>
              <p className="text-xs text-gray-500">Weka nambari ya tarakimu 6 kutoka kwa app yako.</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <div className="flex gap-3 pt-1">
                <button onClick={cancelEnroll}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
                  Ghairi
                </button>
                <button
                  onClick={confirmEnroll}
                  disabled={verifying || verifyCode.length !== 6}
                  className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {verifying ? 'Inathibitisha...' : 'Wezesha 2FA'}
                </button>
              </div>
            </div>
          ) : has2FA ? (
            /* ── 2FA active state ── */
            <div className="px-4 py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-shield-check text-green-600 text-lg" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">2FA Imewezeshwa</p>
                  <p className="text-xs text-gray-500">Akaunti yako inalindwa na uthibitisho wa hatua mbili</p>
                </div>
              </div>
              <button
                onClick={() => setShowUnenroll(true)}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
              >
                Ondoa 2FA
              </button>
            </div>
          ) : (
            /* ── 2FA disabled state ── */
            <div className="px-4 py-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ti ti-shield text-amber-500 text-lg" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">2FA Haijawezeshwa</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ongeza safu ya ziada ya usalama kwa akaunti yako. Baada ya kuingia na nenosiri, utahitajika kutoa nambari kutoka app ya uthibitisho.
                  </p>
                </div>
              </div>
              <button
                onClick={startEnroll}
                disabled={enrolling}
                className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition"
              >
                {enrolling ? 'Inaandaa...' : 'Wezesha 2FA →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unenroll confirmation */}
      {showUnenroll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowUnenroll(false)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <h3 className="text-base font-bold text-gray-900 mb-2 text-center">Ondoa 2FA?</h3>
            <p className="text-sm text-gray-500 mb-7 text-center">
              Kuzima 2FA kutapunguza usalama wa akaunti yako. Una uhakika?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowUnenroll(false)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm">
                Ghairi
              </button>
              <button onClick={handleUnenroll} disabled={unenrolling}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-60">
                {unenrolling ? 'Inaondoa...' : 'Ndio, Ondoa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
