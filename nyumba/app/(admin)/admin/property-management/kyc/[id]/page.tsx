'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
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
  landlord: {
    id: string; full_name: string | null; phone: string | null
    email: string | null; avatar_url: string | null; created_at: string; role: string
  } | null
  reviewer: { id: string; full_name: string | null } | null
  service_request: {
    id: string; request_type: string; status: string; description: string | null; notes: string | null
    listing: { id: string; title: string; region: string; district: string; type: string; status: string } | null
  } | null
}

const STATUS_LABELS: Record<KycStatus, string> = {
  pending:        'Inasubiri Ukaguzi',
  approved:       'Imeidhinishwa',
  rejected:       'Imekataliwa',
  needs_more_info:'Inahitaji Nyaraka Zaidi',
}
const STATUS_COLORS: Record<KycStatus, string> = {
  pending:        'bg-amber-100 text-amber-700 border-amber-200',
  approved:       'bg-green-100 text-green-700 border-green-200',
  rejected:       'bg-red-100 text-red-700 border-red-200',
  needs_more_info:'bg-blue-100 text-blue-700 border-blue-200',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DocCard({ label, url, icon }: { label: string; url: string | null; icon: string }) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${url ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${url ? 'bg-primary-100' : 'bg-gray-100'}`}>
        <i className={`ti ti-${icon} ${url ? 'text-primary-600' : 'text-gray-300'} text-lg`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:underline truncate block mt-0.5">
              <i className="ti ti-external-link mr-1" aria-hidden="true" />Angalia hati
            </a>
          : <p className="text-xs text-gray-400 mt-0.5">Haijawasilishwa</p>
        }
      </div>
      {url && (
        <span className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
          <i className="ti ti-check text-green-600 text-xs" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

export default function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const router  = useRouter()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [history,    setHistory]    = useState<Array<{ id: string; status: KycStatus; submitted_at: string; reviewed_at: string | null }>>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Review form state
  const [action,   setAction]   = useState<'approve' | 'reject' | 'needs_more_info' | null>(null)
  const [notes,    setNotes]    = useState('')
  const [reason,   setReason]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/v1/admin/kyc/${id}`)
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Haipatikani'); return }
        setSubmission(data.submission)
        setHistory(data.history ?? [])
        setNotes(data.submission?.notes ?? '')
      } catch { setError('Hitilafu ya mtandao.') }
      finally  { setLoading(false) }
    }
    load()
  }, [id])

  async function handleReview() {
    if (!action) return
    if (action === 'reject' && !reason.trim()) { setError('Andika sababu ya kukataa'); return }
    setSaving(true); setError(null)
    try {
      const res  = await fetch(`/api/v1/admin/kyc/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim(), rejection_reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setSubmission(data.submission)
      setAction(null)
      if (action === 'approve') router.push('/admin/property-management/kyc')
    } catch { setError('Haikuweza kuhifadhi.') }
    finally  { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3 max-w-3xl mx-auto">
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <Link href="/admin/property-management/kyc" className="text-primary-600 text-sm mt-2 inline-block">← Rudi</Link>
      </div>
    )
  }

  if (!submission) return null

  const landlord = submission.landlord
  const sr       = submission.service_request
  const canReview = ['pending', 'needs_more_info'].includes(submission.status)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/property-management/kyc"
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition">
          <i className="ti ti-arrow-left text-lg" aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Ukaguzi wa KYC</h1>
          <p className="text-xs text-gray-400">Iliwasilishwa {fmtDate(submission.submitted_at)}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[submission.status]}`}>
          {STATUS_LABELS[submission.status]}
        </span>
      </div>

      {/* Landlord profile */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Taarifa za Mmiliki</p>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {landlord?.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={landlord.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-primary-600 font-bold">{landlord?.full_name?.charAt(0)?.toUpperCase() ?? '?'}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{landlord?.full_name ?? '—'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
              {landlord?.phone && (
                <a href={`tel:${landlord.phone}`} className="text-xs text-primary-600 hover:underline">
                  <i className="ti ti-phone mr-0.5" aria-hidden="true" />{landlord.phone}
                </a>
              )}
              {landlord?.email && (
                <a href={`mailto:${landlord.email}`} className="text-xs text-gray-500 hover:underline">
                  <i className="ti ti-mail mr-0.5" aria-hidden="true" />{landlord.email}
                </a>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Akaunti: {fmtDate(landlord?.created_at ?? null)} · Jukumu: {landlord?.role ?? '—'}
            </p>
          </div>
          <Link href={`/admin/users?search=${landlord?.phone ?? landlord?.email ?? ''}`}
            className="flex-shrink-0 text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition">
            Angalia Profaili
          </Link>
        </div>
      </div>

      {/* Linked listing */}
      {sr?.listing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Mali Inayohusiana</p>
          <div className="flex items-center gap-2">
            <i className="ti ti-building text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-800 font-medium">{sr.listing.title}</span>
            <span className="text-xs text-gray-400">· {sr.listing.district}, {sr.listing.region}</span>
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Hati Zilizowasilishwa</p>
        <div className="space-y-2">
          <DocCard label="Kitambulisho cha Taifa / Pasipoti" url={submission.id_document_url} icon="id" />
          <DocCard label="Hati ya Umiliki (Title Deed)"     url={submission.title_deed_url}  icon="file-certificate" />
          <DocCard label="Cheti cha Kodi (TRA)"             url={submission.tax_cert_url}    icon="receipt" />
        </div>
      </div>

      {/* Applicant notes */}
      {submission.notes && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">Maelezo ya Mwombaji</p>
          <p className="text-sm text-gray-700 leading-relaxed">{submission.notes}</p>
        </div>
      )}

      {/* Previous rejection reason */}
      {submission.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-red-600 mb-1">
            <i className="ti ti-alert-circle mr-1" aria-hidden="true" />Sababu ya Kukataa
          </p>
          <p className="text-sm text-red-700 leading-relaxed">{submission.rejection_reason}</p>
        </div>
      )}

      {/* Reviewer info */}
      {submission.reviewer && (
        <p className="text-xs text-gray-400 text-center">
          Ilikaguliwa na {(submission.reviewer as unknown as { full_name: string | null }).full_name} — {fmtDate(submission.reviewed_at)}
        </p>
      )}

      {/* KYC history for this landlord */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Historia ya KYC</p>
          <div className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{fmtDate(h.submitted_at)}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[h.status]}`}>
                  {STATUS_LABELS[h.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review actions */}
      {canReview ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Hatua ya Ukaguzi</p>

          {/* Action selector */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {([
              { key: 'approve',        label: 'Idhinisha',    icon: 'check',          cls: 'border-green-200 text-green-700 hover:bg-green-50'  },
              { key: 'needs_more_info',label: 'Omba Zaidi',   icon: 'info-circle',    cls: 'border-blue-200  text-blue-700  hover:bg-blue-50'   },
              { key: 'reject',         label: 'Kataa',        icon: 'x',              cls: 'border-red-200   text-red-700   hover:bg-red-50'    },
            ] as const).map(a => (
              <button key={a.key} onClick={() => setAction(action === a.key ? null : a.key)}
                className={`border rounded-xl p-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${a.cls} ${action === a.key ? 'ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-70'}`}>
                <i className={`ti ti-${a.icon}`} aria-hidden="true" />{a.label}
              </button>
            ))}
          </div>

          {action && (
            <div className="space-y-2.5 mt-3 pt-3 border-t border-gray-50">
              {action === 'reject' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Sababu ya kukataa <span className="text-red-500">*</span>
                  </label>
                  <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Eleza kwa nini unakataa ombi hili..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
                </div>
              )}
              {action === 'needs_more_info' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Eleza unahitaji nini
                  </label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Mfano: Tuma picha ya hati ya umiliki iliyosomeka vizuri..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
                </div>
              )}
              {action === 'approve' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Maelezo (hiari)</label>
                  <textarea rows={1} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Maelezo ya ziada ya ukaguzi..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none" />
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setAction(null); setError(null) }}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Ghairi
                </button>
                <button onClick={handleReview} disabled={saving}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40 ${
                    action === 'approve' ? 'bg-green-500 hover:bg-green-600' :
                    action === 'reject'  ? 'bg-red-500 hover:bg-red-600' :
                    'bg-blue-500 hover:bg-blue-600'
                  }`}>
                  {saving ? 'Inahifadhi...' :
                    action === 'approve' ? 'Thibitisha Idhinisho' :
                    action === 'reject'  ? 'Thibitisha Kukataa' :
                    'Omba Nyaraka Zaidi'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <button onClick={async () => {
            setSaving(true)
            await fetch(`/api/v1/admin/kyc/${id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reset' }),
            })
            window.location.reload()
          }} disabled={saving}
            className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-40">
            Rudisha hali ya &quot;Inasubiri&quot;
          </button>
        </div>
      )}
    </div>
  )
}
