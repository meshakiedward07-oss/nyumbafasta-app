'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Advertiser = {
  id: string; business_name: string; business_category: string
  contact_phone: string; whatsapp_number: string | null; email: string
  city: string; district: string | null; description: string | null
  logo_url: string | null; website_url: string | null
  status: 'pending_review' | 'active' | 'rejected' | 'suspended'
  rejection_reason: string | null; created_at: string; campaign_count: number
}

const STATUS_TABS = [
  { value: 'all',            label: 'Wote' },
  { value: 'pending_review', label: 'Wanasubiri' },
  { value: 'active',         label: 'Wanaofanya Kazi' },
  { value: 'rejected',       label: 'Walikataliwa' },
  { value: 'suspended',      label: 'Wamesimamishwa' },
]

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  pending_review: { label: 'Anasubiri',      cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  active:         { label: 'Ameidhinishwa',  cls: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-400' },
  rejected:       { label: 'Amekataliwa',    cls: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400' },
  suspended:      { label: 'Amesimamishwa',  cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
}

export default function AdminAdvertisersPage() {
  const [tab, setTab]                   = useState('all')
  const [advertisers, setAdvertisers]   = useState<Advertiser[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')
  const [acting, setActing]             = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  // Reject modal
  const [rejectModal, setRejectModal]   = useState<Advertiser | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Detail drawer
  const [detail, setDetail]             = useState<Advertiser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/adverts/advertisers?status=${tab}`)
      const d = await r.json()
      setAdvertisers(d.advertisers ?? [])
      setTotal(d.total ?? 0)
    } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load() }, [load])

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  async function doAction(id: string, action: string, reason?: string) {
    setActing(true)
    try {
      const res = await fetch('/api/v1/admin/adverts/advertisers', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast(action === 'approve' ? '✅ Ameidhinishwa' : action === 'reject' ? '❌ Amekataliwa' : '⏸ Imesimamishwa')
        setRejectModal(null); setRejectReason(''); setDetail(null)
        await load()
      } else { showToast(`Hitilafu: ${d.error}`, false) }
    } finally { setActing(false) }
  }

  const filtered = advertisers.filter(a =>
    !search || a.business_name.toLowerCase().includes(search.toLowerCase()) ||
    a.city.toLowerCase().includes(search.toLowerCase()) ||
    a.business_category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white animate-in slide-in-from-top-2 ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center mb-3">
              <span className="text-xl">❌</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Kataa Mfanyabiashara</h3>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.business_name} — toa sababu ya kukataa</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Sababu ya kukataa (hiari)..." rows={3} autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ghairi</button>
              <button onClick={() => doAction(rejectModal.id, 'reject', rejectReason)} disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {acting ? '...' : 'Kataa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 text-lg">
                {detail.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-primary-600 font-bold">{detail.business_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{detail.business_name}</p>
                <p className="text-xs text-gray-400">{detail.business_category}</p>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 flex-shrink-0">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status badge */}
              {(() => {
                const sc = STATUS_CFG[detail.status]
                return sc ? (
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border w-fit ${sc.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </div>
                ) : null
              })()}

              <Section title="Mawasiliano">
                <Field label="Simu" value={detail.contact_phone} href={`tel:${detail.contact_phone}`} />
                {detail.whatsapp_number && <Field label="WhatsApp" value={detail.whatsapp_number} href={`https://wa.me/${detail.whatsapp_number.replace(/\D/g,'')}`} />}
                <Field label="Barua Pepe" value={detail.email} href={`mailto:${detail.email}`} />
                {detail.website_url && <Field label="Tovuti" value={detail.website_url} href={detail.website_url} />}
              </Section>

              <Section title="Mahali">
                <Field label="Mji" value={`${detail.city}${detail.district ? `, ${detail.district}` : ''}`} />
              </Section>

              {detail.description && (
                <Section title="Maelezo">
                  <p className="text-sm text-gray-700">{detail.description}</p>
                </Section>
              )}

              {detail.rejection_reason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-500 mb-1">Sababu ya Kukataliwa</p>
                  <p className="text-sm text-red-700">{detail.rejection_reason}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-800">{detail.campaign_count}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Kampeni</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-gray-800">{new Date(detail.created_at).toLocaleDateString('sw-TZ')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Alijisajili</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {(detail.status === 'pending_review' || detail.status === 'suspended') && (
                  <button onClick={() => doAction(detail.id, 'approve')} disabled={acting}
                    className="w-full bg-green-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 transition">
                    ✅ Idhinisha Mfanyabiashara
                  </button>
                )}
                {detail.status === 'pending_review' && (
                  <button onClick={() => { setRejectModal(detail); setDetail(null) }}
                    className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition">
                    ❌ Kataa Mfanyabiashara
                  </button>
                )}
                {detail.status === 'active' && (
                  <button onClick={() => doAction(detail.id, 'suspend')} disabled={acting}
                    className="w-full bg-orange-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition">
                    ⏸ Simamisha Akaunti
                  </button>
                )}
                {detail.campaign_count > 0 && (
                  <Link href={`/admin/adverts?advertiser=${detail.id}`}
                    className="flex items-center justify-center gap-2 w-full border border-primary-200 text-primary-600 py-3 rounded-xl text-sm font-bold hover:bg-primary-50 transition">
                    🎯 Angalia Kampeni ({detail.campaign_count})
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Link href="/admin/adverts" className="hover:text-gray-600 transition">← Kampeni</Link>
              <span>/</span>
              <span className="text-gray-600 font-medium">Wafanyabiashara</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Wafanyabiashara
              {total > 0 && <span className="ml-2 text-base font-normal text-gray-400">({total})</span>}
            </h1>
          </div>
          <Link href="/admin/adverts/plans"
            className="text-sm px-3 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition font-medium">
            📋 Mipango
          </Link>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto">

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 overflow-x-auto shadow-sm flex-1">
            {STATUS_TABS.map(t => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-xl font-medium transition ${
                  tab === t.value ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta biashara, mji..."
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 w-full sm:w-56"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-20">
            <div className="text-5xl mb-3">🏪</div>
            <p className="font-semibold text-gray-600">Hakuna wafanyabiashara</p>
            <p className="text-sm text-gray-400 mt-1">{search ? `Hakuna matokeo ya "${search}"` : `Hakuna ${tab !== 'all' ? STATUS_TABS.find(t => t.value === tab)?.label : 'wafanyabiashara'} sasa hivi`}</p>
          </div>
        )}

        {/* Grid of cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(a => {
              const sc = STATUS_CFG[a.status]
              return (
                <div key={a.id}
                  className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setDetail(a)}>
                  <div className="flex items-center gap-3 p-4">
                    {/* Logo */}
                    <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {a.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary-600 font-bold text-base">{a.business_name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm truncate">{a.business_name}</span>
                        {sc && (
                          <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${sc.cls}`}>
                            <span className={`w-1 h-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1">
                        <span>📂 {a.business_category}</span>
                        <span>📍 {a.city}{a.district ? `, ${a.district}` : ''}</span>
                        <span>📅 {new Date(a.created_at).toLocaleDateString('sw-TZ')}</span>
                        {a.campaign_count > 0 && <span className="text-primary-600 font-semibold">🎯 {a.campaign_count} kampeni</span>}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {(a.status === 'pending_review' || a.status === 'suspended') && (
                        <button onClick={() => doAction(a.id, 'approve')} disabled={acting}
                          className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition">
                          ✓ Idhinisha
                        </button>
                      )}
                      {a.status === 'pending_review' && (
                        <button onClick={() => { setRejectModal(a) }}
                          className="text-xs bg-red-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-600 font-medium transition">
                          ✗ Kataa
                        </button>
                      )}
                      {a.status === 'active' && (
                        <button onClick={() => doAction(a.id, 'suspend')} disabled={acting}
                          className="text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium transition">
                          ⏸ Simamisha
                        </button>
                      )}
                      <button onClick={() => setDetail(a)}
                        className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition">
                        Angalia →
                      </button>
                    </div>
                  </div>

                  {/* Rejection reason inline */}
                  {a.rejection_reason && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                        <span className="font-semibold">Sababu ya kukataliwa:</span> {a.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {total > 30 && !loading && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Kuonyesha {filtered.length} kati ya {total}
          </p>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400 text-xs flex-shrink-0">{label}</span>
      <span className={`font-medium text-right max-w-[65%] truncate ${href ? 'text-primary-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition">{content}</a> : content
}
