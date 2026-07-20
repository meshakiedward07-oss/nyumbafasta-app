'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Payment = { id: string; amount: number; status: string; paid_at: string | null; provider: string; phone_number: string | null }
type Campaign = {
  id: string; title: string; ad_type: string; status: string; payment_status: string
  target_region: string; target_category: string | null; created_at: string
  starts_at: string | null; expires_at: string | null; admin_note: string | null
  image_url: string | null; link_url: string | null; creative_id: string | null
  body_text: string | null; cta_type: string | null; cta_value: string | null
  advertiser: { id: string; business_name: string; contact_name: string; contact_phone: string; email: string; city: string; status: string; whatsapp_number?: string } | null
  plan: { name: string; ad_type: string; price_tzs: number; duration_days: number } | null
  payments: Payment[]
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  pending_review: { label: 'Inasubiri Ukaguzi', cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  approved:       { label: 'Imeidhinishwa',      cls: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-400' },
  active:         { label: 'Inafanya Kazi',       cls: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-400' },
  rejected:       { label: 'Imekataliwa',         cls: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400' },
  suspended:      { label: 'Imesimamishwa',       cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  expired:        { label: 'Imekwisha',           cls: 'bg-gray-100 text-gray-500 border-gray-200',     dot: 'bg-gray-300' },
}

const AD_TYPE_ICONS: Record<string, string> = {
  banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐', directory: '📂', bundle: '📦',
}

export default function CampaignDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading]   = useState(true)
  const [reason, setReason]     = useState('')
  const [acting, setActing]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/v1/admin/adverts/${id}`)
      .then(r => r.json())
      .then(d => { setCampaign(d.campaign ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  async function doAction(action: 'approve' | 'reject' | 'suspend' | 'activate') {
    setActing(true)
    const res = await fetch(`/api/v1/admin/adverts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason || undefined }),
    })
    const d = await res.json()
    if (res.ok) { setCampaign(d.campaign ?? null); setReason(''); showToast('Imefanikiwa ✓') }
    else showToast(`Hitilafu: ${d.error}`, false)
    setActing(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50/60 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
      </div>
    </div>
  )

  if (!campaign) return (
    <div className="min-h-screen bg-gray-50/60 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-3">🔍</div>
        <p className="text-gray-600 font-medium mb-4">Kampeni haikupatikana</p>
        <Link href="/admin/adverts" className="text-primary-600 text-sm hover:underline">← Rudi kwenye orodha</Link>
      </div>
    </div>
  )

  const adv    = campaign.advertiser
  const plan   = campaign.plan
  const sc     = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.expired

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white animate-in slide-in-from-top-2 ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition flex-shrink-0">
            <i className="ti ti-arrow-left" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
              <Link href="/admin/adverts" className="hover:text-gray-600 transition">Kampeni</Link>
              <span>/</span>
              <span className="text-gray-600 font-medium truncate">{campaign.title}</span>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${sc.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {sc.label}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Campaign info */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
                <span className="text-base">{AD_TYPE_ICONS[campaign.ad_type] ?? '📢'}</span>
                <h2 className="text-sm font-bold text-gray-700">Taarifa za Kampeni</h2>
              </div>
              <div className="p-5 space-y-3">
                <InfoRow label="Kichwa" value={campaign.title} />
                <InfoRow label="Aina" value={campaign.ad_type.toUpperCase()} badge />
                <InfoRow label="Mkoa" value={campaign.target_region} />
                {campaign.target_category && <InfoRow label="Kategoria" value={campaign.target_category} />}
                {campaign.body_text && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Maandishi</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{campaign.body_text}</p>
                  </div>
                )}
                {campaign.cta_type && <InfoRow label="CTA" value={`${campaign.cta_type} → ${campaign.cta_value ?? ''}`} />}
                {campaign.link_url && <InfoRow label="Link" value={campaign.link_url} />}
                {campaign.starts_at && <InfoRow label="Ilianza" value={new Date(campaign.starts_at).toLocaleDateString('sw-TZ')} />}
                {campaign.expires_at && <InfoRow label="Inaisha" value={new Date(campaign.expires_at).toLocaleDateString('sw-TZ')} />}
                <InfoRow label="Imeundwa" value={new Date(campaign.created_at).toLocaleDateString('sw-TZ')} />
              </div>
            </div>

            {/* Creative preview */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span>🖼</span>
                  <h2 className="text-sm font-bold text-gray-700">Creative</h2>
                </div>
                {campaign.creative_id ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Imepakiwa</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ Haijapakiwa</span>
                )}
              </div>
              <div className="p-5">
                {campaign.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={campaign.image_url} alt="Ad creative"
                    className="w-full rounded-xl object-contain max-h-56 border border-gray-100 bg-gray-50" />
                ) : (
                  <div className="h-28 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                    <p className="text-xs text-gray-400">Picha haijapakuliwa bado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Advertiser */}
            {adv && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
                  <span>🏪</span>
                  <h2 className="text-sm font-bold text-gray-700">Mfanyabiashara</h2>
                  <Link href={`/admin/adverts/advertisers`}
                    className="ml-auto text-xs text-primary-600 hover:underline">Angalia Wote →</Link>
                </div>
                <div className="p-5 space-y-3">
                  <InfoRow label="Biashara" value={adv.business_name} />
                  <InfoRow label="Jina" value={adv.contact_name} />
                  <InfoRow label="Mji" value={adv.city} />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a href={`tel:${adv.contact_phone}`}
                      className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-100 transition font-medium">
                      📞 {adv.contact_phone}
                    </a>
                    {adv.email && (
                      <a href={`mailto:${adv.email}`}
                        className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-100 transition font-medium truncate">
                        ✉ {adv.email}
                      </a>
                    )}
                  </div>
                  {adv.whatsapp_number && (
                    <a href={`https://wa.me/${adv.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-green-700 hover:bg-green-100 transition font-medium w-full">
                      💬 WhatsApp: {adv.whatsapp_number}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-4">

            {/* Actions panel */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-4">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
                <span>⚡</span>
                <h2 className="text-sm font-bold text-gray-700">Hatua</h2>
              </div>
              <div className="p-4 space-y-3">
                {/* Admin note */}
                {campaign.admin_note && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm text-amber-700">
                    <p className="text-xs font-semibold text-amber-500 mb-0.5">Kumbuka ya Admin</p>
                    {campaign.admin_note}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Sababu (ya kukataa / kusimamisha)</label>
                  <textarea
                    value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Andika sababu hapa (hiari)..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>

                {campaign.status === 'pending_review' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => doAction('approve')} disabled={acting}
                      className="flex items-center justify-center gap-1.5 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 transition">
                      {acting ? '...' : '✅ Idhinisha'}
                    </button>
                    <button onClick={() => doAction('reject')} disabled={acting}
                      className="flex items-center justify-center gap-1.5 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition">
                      {acting ? '...' : '❌ Kataa'}
                    </button>
                  </div>
                )}
                {campaign.status === 'active' && (
                  <button onClick={() => doAction('suspend')} disabled={acting}
                    className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition">
                    {acting ? '...' : '⏸ Simamisha'}
                  </button>
                )}
                {(campaign.status === 'suspended' || campaign.status === 'approved') && (
                  <button onClick={() => doAction('activate')} disabled={acting}
                    className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition">
                    {acting ? '...' : '▶ Amilisha'}
                  </button>
                )}
              </div>
            </div>

            {/* Plan */}
            {plan && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
                  <span>📋</span>
                  <h2 className="text-sm font-bold text-gray-700">Mpango</h2>
                </div>
                <div className="p-5 space-y-3">
                  <InfoRow label="Jina" value={plan.name} />
                  <InfoRow label="Bei" value={`Tsh ${plan.price_tzs.toLocaleString()}`} />
                  <InfoRow label="Muda" value={`Siku ${plan.duration_days}`} />
                </div>
              </div>
            )}

            {/* Payments */}
            {(campaign.payments?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50">
                  <span>💳</span>
                  <h2 className="text-sm font-bold text-gray-700">Malipo</h2>
                </div>
                <div className="p-4 space-y-2">
                  {(campaign.payments ?? []).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{p.provider}</p>
                        <p className="text-[10px] text-gray-400">{p.phone_number ?? 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">Tsh {p.amount.toLocaleString()}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-400 flex-shrink-0">{label}</span>
      {badge ? (
        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{value}</span>
      ) : (
        <span className="text-gray-800 font-medium text-right truncate max-w-[60%]">{value}</span>
      )}
    </div>
  )
}
