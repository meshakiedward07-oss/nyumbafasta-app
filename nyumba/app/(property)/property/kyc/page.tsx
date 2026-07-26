'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type KycStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info'

interface Submission {
  id:               string
  status:           KycStatus
  submitted_at:     string
  reviewed_at:      string | null
  notes:            string | null
  rejection_reason: string | null
  id_document_url:  string | null
  title_deed_url:   string | null
  tax_cert_url:     string | null
}

const STATUS_INFO: Record<KycStatus, { label: string; color: string; icon: string; desc: string }> = {
  pending:        { label: 'Inasubiri Ukaguzi', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'clock',         desc: 'Maombi yako yamefika. Tutakagua ndani ya saa 24–48.' },
  approved:       { label: 'Imeidhinishwa',     color: 'bg-green-50 border-green-200 text-green-700', icon: 'circle-check',  desc: 'Hongera! Akaunti yako imethibitishwa.' },
  rejected:       { label: 'Imekataliwa',       color: 'bg-red-50   border-red-200   text-red-700',   icon: 'circle-x',      desc: 'Maombi yako yamekataliwa. Angalia sababu hapa chini.' },
  needs_more_info:{ label: 'Inahitaji Zaidi',   color: 'bg-blue-50  border-blue-200  text-blue-700',  icon: 'info-circle',   desc: 'Admin anahitaji nyaraka zaidi. Tafadhali tuma zilizokosekana.' },
}

export default function KycSubmitPage() {
  const router = useRouter()
  const [submission,  setSubmission]  = useState<Submission | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)
  const [form, setForm] = useState({
    id_document_url:  '',
    title_deed_url:   '',
    tax_cert_url:     '',
    notes:            '',
  })

  useEffect(() => {
    fetch('/api/v1/kyc')
      .then(r => r.json())
      .then(d => {
        setSubmission(d.submission)
        if (d.submission) {
          setForm({
            id_document_url:  d.submission.id_document_url  ?? '',
            title_deed_url:   d.submission.title_deed_url   ?? '',
            tax_cert_url:     d.submission.tax_cert_url     ?? '',
            notes:            d.submission.notes            ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.id_document_url.trim()) { setError('Picha ya kitambulisho inahitajika'); return }
    setSubmitting(true); setError(null)
    try {
      const res  = await fetch('/api/v1/kyc', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setSuccess(true)
      setTimeout(() => router.push('/property/dashboard'), 2000)
    } catch { setError('Haikuweza kutuma. Jaribu tena.') }
    finally  { setSubmitting(false) }
  }

  if (loading) {
    return <div className="p-6 max-w-2xl mx-auto space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
    </div>
  }

  const statusInfo = submission ? STATUS_INFO[submission.status] : null
  const canSubmit  = !submission || submission.status === 'needs_more_info' || submission.status === 'rejected'

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition">
          <i className="ti ti-arrow-left text-lg" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Uthibitisho wa KYC</h1>
          <p className="text-xs text-gray-400 mt-0.5">Thibitisha umiliki wa mali na utambulisho wako</p>
        </div>
      </div>

      {/* Current status banner */}
      {statusInfo && submission && (
        <div className={`rounded-2xl border p-4 mb-6 ${statusInfo.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <i className={`ti ti-${statusInfo.icon} text-lg`} aria-hidden="true" />
            <span className="font-semibold text-sm">{statusInfo.label}</span>
          </div>
          <p className="text-xs opacity-80">{statusInfo.desc}</p>
          {submission.rejection_reason && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <p className="text-xs font-semibold">Sababu ya kukataa:</p>
              <p className="text-xs mt-0.5">{submission.rejection_reason}</p>
            </div>
          )}
          {submission.notes && submission.status === 'needs_more_info' && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <p className="text-xs font-semibold">Maelezo ya admin:</p>
              <p className="text-xs mt-0.5">{submission.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Approved — no form needed */}
      {submission?.status === 'approved' ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-rosette-discount-check text-4xl text-green-500" aria-hidden="true" />
          </div>
          <p className="font-semibold text-gray-900">Akaunti Imethibitishwa</p>
          <p className="text-sm text-gray-400 mt-1">Huna zaidi ya kufanya. Unaweza kutumia huduma zote.</p>
          <button onClick={() => router.push('/property/dashboard')}
            className="mt-4 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
            Rudi Dashibodini
          </button>
        </div>
      ) : (
        <>
          {/* What we need */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-600 mb-3">Unahitaji nini</p>
            <div className="space-y-2">
              {[
                { icon: 'id',               label: 'Kitambulisho cha Taifa au Pasipoti',  required: true  },
                { icon: 'file-certificate', label: 'Hati ya Umiliki wa Mali (Title Deed)', required: false },
                { icon: 'receipt',          label: 'Cheti cha Kodi cha TRA',              required: false },
              ].map(d => (
                <div key={d.icon} className="flex items-center gap-2 text-xs">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${d.required ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'}`}>
                    <i className={`ti ti-${d.icon} text-xs`} aria-hidden="true" />
                  </div>
                  <span className="text-gray-600">{d.label}</span>
                  {d.required && <span className="text-red-500 text-[10px] font-bold">LAZIMA</span>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              Pakia hati kwenye Cloudinary, Google Drive, au huduma nyingine ya faili, kisha bandika kiungo hapa chini.
            </p>
          </div>

          {/* Success */}
          {success ? (
            <div className="text-center py-8">
              <i className="ti ti-circle-check text-5xl text-green-500" aria-hidden="true" />
              <p className="font-semibold text-gray-900 mt-2">Imetumwa!</p>
              <p className="text-sm text-gray-400 mt-1">Tunakupeleka dashibodini...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Kiungo cha Kitambulisho (ID/Pasipoti) <span className="text-red-500">*</span>
                </label>
                <input type="url" value={form.id_document_url}
                  onChange={e => setForm(p => ({ ...p, id_document_url: e.target.value }))}
                  placeholder="https://drive.google.com/... au https://res.cloudinary.com/..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Kiungo cha Hati ya Umiliki (Title Deed)</label>
                <input type="url" value={form.title_deed_url}
                  onChange={e => setForm(p => ({ ...p, title_deed_url: e.target.value }))}
                  placeholder="https://... (hiari)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Kiungo cha Cheti cha Kodi (TRA)</label>
                <input type="url" value={form.tax_cert_url}
                  onChange={e => setForm(p => ({ ...p, tax_cert_url: e.target.value }))}
                  placeholder="https://... (hiari)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Maelezo ya ziada (hiari)</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Maelezo yoyote unayotaka kutujulisha..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button type="submit" disabled={submitting || !canSubmit}
                className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                {submitting ? 'Inatuma...' : submission?.status === 'needs_more_info' ? 'Tuma Nyaraka Zaidi' : 'Wasilisha Ombi la KYC'}
              </button>

              {!canSubmit && (
                <p className="text-xs text-gray-400 text-center">Ombi lako liko chini ya ukaguzi. Subiri jibu.</p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  )
}
