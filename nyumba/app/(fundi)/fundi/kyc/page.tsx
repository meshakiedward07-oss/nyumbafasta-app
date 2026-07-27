'use client'
import { useEffect, useState } from 'react'

interface KycDoc {
  id: string; document_type: string; document_url: string; document_name: string | null
  status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null; submitted_at: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  business_licence:           'Leseni ya Biashara',
  qualification_certificate:  'Cheti cha Utaalamu',
  national_id:                'Kitambulisho cha Taifa',
  other:                      'Hati Nyingine',
}

const STATUS_STYLE: Record<string, { cls: string; label: string; icon: string }> = {
  pending:  { cls: 'bg-amber-50 text-amber-700',  label: 'Inakaguliwa', icon: 'clock'        },
  approved: { cls: 'bg-green-50 text-green-700',  label: 'Imeidhinishwa', icon: 'circle-check'},
  rejected: { cls: 'bg-red-50 text-red-600',      label: 'Ilikataliwa',  icon: 'circle-x'    },
}

export default function FundiKycPage() {
  const [docs,      setDocs]      = useState<KycDoc[]>([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState({ document_type: 'qualification_certificate', document_url: '', document_name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formErr,   setFormErr]   = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function load() {
    try {
      const res  = await fetch('/api/v1/fundi/kyc')
      const data = await res.json()
      setDocs(data.kyc ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.document_url.trim()) { setFormErr('Kiungo cha hati kinahitajika'); return }
    setSubmitting(true); setFormErr(null)
    try {
      const res = await fetch('/api/v1/fundi/kyc', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Kuna tatizo'); return }
      setForm({ document_type: 'qualification_certificate', document_url: '', document_name: '' })
      setSubmitted(true)
      await load()
    } catch { setFormErr('Haikuweza kutuma. Jaribu tena.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Hati za KYC</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tuma hati zako ili admin akuthibitishe</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold text-blue-800 mb-1">Jinsi ya Kutuma Hati</p>
        <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
          <li>Pakia hati yako kwenye Google Drive, Dropbox au iCloud</li>
          <li>Fanya kiungo kiwe cha &quot;mtu yeyote anayeona&quot; (public link)</li>
          <li>Nakili kiungo na paste hapa chini</li>
          <li>Chagua aina ya hati na tuma</li>
        </ol>
      </div>

      {/* Existing docs */}
      {loading ? (
        <div className="space-y-2 mb-5">{[1,2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
      ) : docs.length > 0 && (
        <div className="space-y-3 mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hati Zilizotumwa</p>
          {docs.map(doc => {
            const s = STATUS_STYLE[doc.status] ?? STATUS_STYLE.pending
            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</p>
                    {doc.document_name && <p className="text-xs text-gray-400">{doc.document_name}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(doc.submitted_at).toLocaleDateString('sw-TZ')}
                    </p>
                    {doc.status === 'rejected' && doc.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">Sababu: {doc.rejection_reason}</p>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex items-center gap-1 flex-shrink-0 ${s.cls}`}>
                    <i className={`ti ti-${s.icon} text-xs`} aria-hidden="true" />
                    {s.label}
                  </span>
                </div>
                {doc.status !== 'rejected' && (
                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 text-xs text-primary-600 hover:underline flex items-center gap-1">
                    <i className="ti ti-external-link text-xs" aria-hidden="true" /> Angalia Hati
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Success message */}
      {submitted && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <i className="ti ti-circle-check text-green-500 text-xl" aria-hidden="true" />
          <p className="text-sm text-green-700">Hati imetumwa. Admin ataikagua hivi karibuni.</p>
        </div>
      )}

      {/* Submit form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">Tuma Hati Mpya</p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Aina ya Hati</label>
          <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Kiungo cha Hati *</label>
          <input value={form.document_url} onChange={e => setForm(f => ({ ...f, document_url: e.target.value }))}
            placeholder="https://drive.google.com/file/..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Jina la Hati (hiari)</label>
          <input value={form.document_name} onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))}
            placeholder="mfano: Leseni_2026.pdf"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        {formErr && <p className="text-sm text-red-600">{formErr}</p>}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
          {submitting ? 'Inatuma...' : 'Tuma Hati'}
        </button>
      </div>
    </div>
  )
}
