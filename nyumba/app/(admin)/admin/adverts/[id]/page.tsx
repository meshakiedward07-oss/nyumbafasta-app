'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCampaignTotalPrice } from '@/lib/ads/campaignPrice'

type Payment = { id: string; amount: number; status: string; paid_at: string | null; provider: string; phone_number: string | null }
type Campaign = {
  id: string; title: string; ad_type: string; status: string; payment_status: string
  target_region: string; target_category: string | null; created_at: string
  starts_at: string | null; expires_at: string | null; admin_note: string | null
  image_url: string | null; video_url: string | null; link_url: string | null; creative_id: string | null
  target_wards: string[] | null
  body_text: string | null; cta_type: string | null; cta_value: string | null
  advertiser: { id: string; business_name: string; contact_phone: string; email: string; city: string; status: string; whatsapp_number?: string } | null
  plan: { name: string; ad_type: string; price_tzs: number; duration_days: number; geo_scope?: string } | null
  payments: Payment[]
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  pending_review: { label: 'Inasubiri Ukaguzi', cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  approved:       { label: 'Imeidhinishwa',      cls: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-400' },
  queued:         { label: 'Foleni ya Nafasi',    cls: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
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
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'suspend' | 'activate' | null>(null)

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
                {campaign.target_wards && campaign.target_wards.length > 0 && (
                  <InfoRow label="Kata" value={campaign.target_wards.join(', ')} />
                )}
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
                {campaign.video_url ? (
                  <video
                    src={campaign.video_url}
                    poster={campaign.image_url ?? undefined}
                    controls
                    playsInline
                    className="w-full rounded-xl max-h-80 border border-gray-100 bg-black"
                  />
                ) : campaign.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={campaign.image_url} alt="Ad creative"
                    className="w-full rounded-xl object-contain max-h-56 border border-gray-100 bg-gray-50" />
                ) : (
                  <div className="h-28 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                    <p className="text-xs text-gray-400">Picha/video ya tangazo haijapakuliwa bado</p>
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

            {/* Diagnostic panel */}
            <DiagnosticPanel campaign={campaign} />
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
                    <button onClick={() => setPendingAction('approve')} disabled={acting}
                      className="flex items-center justify-center gap-1.5 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50 transition">
                      {acting ? '...' : '✅ Idhinisha'}
                    </button>
                    <button onClick={() => setPendingAction('reject')} disabled={acting}
                      className="flex items-center justify-center gap-1.5 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition">
                      {acting ? '...' : '❌ Kataa'}
                    </button>
                  </div>
                )}
                {campaign.status === 'active' && (
                  <button onClick={() => setPendingAction('suspend')} disabled={acting}
                    className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition">
                    {acting ? '...' : '⏸ Simamisha'}
                  </button>
                )}
                {(campaign.status === 'suspended' || campaign.status === 'approved') && (
                  <button onClick={() => setPendingAction('activate')} disabled={acting}
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
                  {plan.geo_scope === 'ward' && (campaign.target_wards?.length ?? 0) > 0 && (
                    <InfoRow label="Bei ya Kata" value={`Tsh ${plan.price_tzs.toLocaleString()} × ${campaign.target_wards!.length} kata`} />
                  )}
                  <InfoRow label="Bei Jumla" value={`Tsh ${getCampaignTotalPrice(plan.price_tzs, plan.geo_scope, campaign.target_wards).toLocaleString()}`} />
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

      {/* ── Confirmation modal ── */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingAction(null)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto sm:hidden mb-2" />
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">
                {pendingAction === 'approve'  && 'Idhinisha Kampeni?'}
                {pendingAction === 'reject'   && 'Kataa Kampeni?'}
                {pendingAction === 'suspend'  && 'Simamisha Kampeni?'}
                {pendingAction === 'activate' && 'Amilisha Kampeni?'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {pendingAction === 'approve'  && 'Kampeni itaonekana kwa watumizi baada ya kuidhinishwa.'}
                {pendingAction === 'reject'   && 'Kampeni itakataliwa na mfanyabiashara atafahamishwa.'}
                {pendingAction === 'suspend'  && 'Kampeni itasimama mara moja na haitaonekana kwa watumizi.'}
                {pendingAction === 'activate' && 'Kampeni itaanza tena na kuonekana kwa watumizi.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => setPendingAction(null)}
                className="py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Hapana
              </button>
              <button
                onClick={async () => { const a = pendingAction; setPendingAction(null); await doAction(a) }}
                disabled={acting}
                className={`py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition ${
                  pendingAction === 'approve'  ? 'bg-green-500 hover:bg-green-600' :
                  pendingAction === 'reject'   ? 'bg-red-500 hover:bg-red-600' :
                  pendingAction === 'suspend'  ? 'bg-orange-500 hover:bg-orange-600' :
                                                 'bg-primary-500 hover:bg-primary-600'
                }`}>
                {pendingAction === 'approve'  && 'Ndio, Idhinisha'}
                {pendingAction === 'reject'   && 'Ndio, Kataa'}
                {pendingAction === 'suspend'  && 'Ndio, Simamisha'}
                {pendingAction === 'activate' && 'Ndio, Amilisha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Diagnostic engine ─────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info' | 'success'

interface DiagItem {
  id:          string
  severity:    Severity
  title:       string
  explanation: string
  solution:    string
}

function runDiagnostics(campaign: Campaign): DiagItem[] {
  const items: DiagItem[] = []
  const now   = new Date()
  const pmts  = campaign.payments ?? []
  const adv   = campaign.advertiser

  // ── Advertiser account issues ──────────────────────────────────────────────
  if (adv?.status === 'suspended') {
    items.push({
      id: 'adv_suspended', severity: 'critical',
      title: 'Akaunti ya Mfanyabiashara Imesimamishwa',
      explanation: `Akaunti ya ${adv.business_name} imesimamishwa na admin. Kampeni zake zote haziwezi kufanya kazi hadi akaunti iamilishwe tena.`,
      solution: 'Nenda kwenye "Wafanyabiashara" → angalia sababu ya kusimamishwa → ikiwa tatizo limetatuliwa, amilisha akaunti ya mfanyabiashara kwanza, kisha urudi uamilishe kampeni hii.',
    })
  }

  if (adv?.status === 'pending_review') {
    items.push({
      id: 'adv_pending', severity: 'critical',
      title: 'Akaunti ya Mfanyabiashara Bado Haijaidhinishwa',
      explanation: `${adv.business_name} bado hajakaguliwa na admin. Kampeni haiwezi kuendelea hadi akaunti ya mfanyabiashara ikaguliwe na kuidhinishwa kwanza.`,
      solution: 'Nenda kwenye sehemu ya "Wafanyabiashara", tafuta mfanyabiashara huyu, kagua taarifa zake za biashara, kisha uidhinishe akaunti yake. Baada ya hapo, rudi hapa ukague kampeni hii.',
    })
  }

  if (adv?.status === 'rejected') {
    items.push({
      id: 'adv_rejected', severity: 'critical',
      title: 'Akaunti ya Mfanyabiashara Imekataliwa',
      explanation: `Akaunti ya ${adv.business_name} ilikataliwa. Kampeni yoyote inayomilikiwa na mfanyabiashara huyu haiwezi kufanya kazi hadi wajisajili upya na wakubaliwe.`,
      solution: 'Wasiliana na mfanyabiashara — eleza sababu ya kukataliwa na waambie wajisajili upya ikiwa tatizo limetatuliwa. Unaweza kuwafikia kwa WhatsApp au barua pepe zilizopo katika kadi ya "Mfanyabiashara" hapo juu.',
    })
  }

  // ── Payment ↔ Status mismatches ────────────────────────────────────────────
  if (campaign.status === 'pending_review' && campaign.payment_status === 'completed') {
    items.push({
      id: 'paid_unreviewed', severity: 'critical',
      title: 'Malipo Yamekamilika — Kampeni Inasubiri Ukaguzi Wako',
      explanation: `Mfanyabiashara amekwisha lipa kikamilifu lakini kampeni bado haijapitia ukaguzi. Hali hii inaweza kumkasirisha mfanyabiashara kwani pesa yake imeshughulikiwa lakini tangazo lake halijaingia bado. Kila siku inayopita bila kukagua ni hasara ya pesa za mfanyabiashara.`,
      solution: 'Kagua kampeni haraka sasa. Angalia: (1) Picha ya tangazo — iko katika "Creative" hapo juu, (2) Maandishi ya tangazo na kiungo, (3) Mkoa na kategoria zilizowekwa. Ikiwa yote iko sawa, bonyeza "Idhinisha" — kampeni itaanza mara moja kwa sababu malipo yamekwisha lipa.',
    })
  }

  if (campaign.status === 'approved' && campaign.payment_status !== 'completed') {
    const hint = campaign.payment_status === 'failed'
      ? 'Malipo yameshindwa — omba mfanyabiashara ajaribu tena au atumie nambari nyingine ya simu. Angalia sehemu ya "Malipo" hapo chini kwa maelezo zaidi.'
      : campaign.payment_status === 'pending'
        ? 'Malipo yanachakatwa — subiri dakika 5-10 kisha uburudishe ukurasa ili kuona kama hali imebadilika.'
        : 'Mfanyabiashara bado hajalipa — tuma ukumbusho wa WhatsApp au barua pepe ukimwambia kampeni yake imeidhinishwa na anasubiriwa kulipa.'
    items.push({
      id: 'approved_unpaid', severity: 'warning',
      title: 'Kampeni Imeidhinishwa — Malipo Hayajakamilika',
      explanation: `Admin ameidhinisha kampeni lakini malipo bado hayajakamilika (hali ya malipo: "${campaign.payment_status ?? 'haijajulikana'}"). Kampeni haitaanza hadi malipo yapokelewa. Mfanyabiashara anachelewa kuanza kutangaza.`,
      solution: hint,
    })
  }

  if (campaign.status === 'pending_review' && campaign.payment_status !== 'completed') {
    items.push({
      id: 'pending_unpaid', severity: 'info',
      title: 'Kampeni Inasubiri Ukaguzi na Malipo',
      explanation: `Kampeni bado haijapitia ukaguzi na malipo pia hayajakamilika. Hii ni hali ya kawaida kwa kampeni mpya — mfanyabiashara anasubiri ukaguzi wa awali kabla ya kulipa.`,
      solution: 'Kagua maudhui ya kampeni (picha, maandishi, mkoa). Ikiwa yote iko sawa, unaweza kuiidhinisha — kampeni itaanza moja kwa moja mara malipo yanapokewa. Ikiwa kuna tatizo la maudhui, ikatae sasa na ueleze sababu wazi.',
    })
  }

  // ── Creative missing ───────────────────────────────────────────────────────
  if (!campaign.creative_id && !campaign.image_url) {
    items.push({
      id: 'no_creative', severity: campaign.status === 'active' ? 'critical' : 'warning',
      title: campaign.status === 'active'
        ? 'Tatizo: Kampeni Inafanya Kazi Bila Picha ya Tangazo'
        : 'Picha ya Tangazo Haijapakuliwa',
      explanation: campaign.status === 'active'
        ? 'Tangazo linafanya kazi lakini haina picha (creative). Wateja wanaona tangazo lisilo na muonekano mzuri, ambalo linathiri ubora wa kampeni na inaweza kupunguza ufanisi wake kwa kiasi kikubwa.'
        : 'Kampeni haina picha ya tangazo (creative). Bila picha, tangazo haliwezi kuonyeshwa vizuri kwa wateja na linaweza kukataliwa baada ya ukaguzi.',
      solution: 'Omba mfanyabiashara apakue picha ya tangazo kupitia akaunti yao (Dashboard → Matangazo → Hariri). Picha inapaswa: (1) Kuwa angalau 1200×628 px, (2) Chini ya 2MB, (3) Muundo wa JPG au PNG wenye ubora wa juu.',
    })
  }

  // ── Date/expiry issues ─────────────────────────────────────────────────────
  if (campaign.expires_at) {
    const expiresAt = new Date(campaign.expires_at)
    const daysLeft  = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)

    if (campaign.status === 'active' && daysLeft <= 3 && daysLeft > 0) {
      items.push({
        id: 'expiring_soon', severity: 'warning',
        title: `Kampeni Inaisha Baada ya Siku ${daysLeft} Tu`,
        explanation: `Tangazo hili litakwisha tarehe ${expiresAt.toLocaleDateString('sw-TZ')}. Baada ya tarehe hiyo, tangazo litaacha kuonekana kwa wateja na hali itabadilika kuwa "Imekwisha" otomatiki.`,
        solution: `Wasiliana na mfanyabiashara leo hii. Wataarifu kwa WhatsApp au barua pepe kwamba kampeni yao inaisha baada ya siku ${daysLeft} na wanaweza kuagiza mpango mpya ili kuendelea kutangaza. Kiungo cha kuagiza ni: [akaunti yao → Matangazo → Agiza Upya].`,
      })
    }

    if (expiresAt < now && campaign.status === 'active') {
      items.push({
        id: 'past_expiry_active', severity: 'critical',
        title: 'Tatizo la Mfumo: Kampeni Imekwisha Lakini Bado Inaonyesha "Inafanya Kazi"',
        explanation: `Tarehe ya kumalizika ilikuwa ${expiresAt.toLocaleDateString('sw-TZ')} lakini hali ya kampeni bado ni "active". Hii inamaanisha cron job haikutekelezwa kwa wakati, au kuna tatizo la mfumo. Mfanyabiashara anaweza kufikiri bado anapata huduma lakini kwa kweli kampeni inahitaji kusasishwa.`,
        solution: 'Hatua mbili zinazohitajika: (1) Badilisha hali ya kampeni hii kuwa "Expired" moja kwa moja kwa kutumia API ya admin, (2) Nenda Admin → Crons na angalia cron ya "expire_ad_campaigns" kuhakikisha inafanya kazi vizuri kwa kampeni nyingine pia.',
      })
    }
  }

  if (!campaign.starts_at && campaign.status === 'active') {
    items.push({
      id: 'active_no_start', severity: 'warning',
      title: 'Kampeni Iko Active Bila Tarehe ya Kuanza Iliyorekodiwa',
      explanation: 'Kampeni inafanya kazi lakini tarehe ya kuanza haijawekwa katika mfumo. Hii inafanya iwe vigumu kufuatilia muda kamili wa kampeni na kuhesabu siku zilizobaki.',
      solution: 'Angalia rekodi za malipo hapo chini — tarehe ya malipo yaliyofanikiwa ndiyo tarehe ya kuanza. Weka tarehe hiyo katika rekodi ya kampeni ili takwimu za kampeni ziwe sahihi.',
    })
  }

  // ── Payment issues ─────────────────────────────────────────────────────────
  const failedPmts    = pmts.filter(p => p.status === 'failed')
  const pendingPmts   = pmts.filter(p => p.status === 'pending')
  const completedPmts = pmts.filter(p => p.status === 'completed')

  if (failedPmts.length > 0 && completedPmts.length === 0) {
    items.push({
      id: 'payment_failed', severity: 'critical',
      title: `Malipo Yameshindwa — Majaribio ${failedPmts.length}`,
      explanation: `Mfanyabiashara amejaribu kulipa mara ${failedPmts.length} kupitia ${failedPmts[0].provider} lakini majaribio yote yameshindwa. Mfanyabiashara hawezi kuendelea na kampeni yake hadi tatizo la malipo litatuliwe. Kila siku inayopita ni msongo wa mawazo kwa mfanyabiashara.`,
      solution: 'Wasiliana na mfanyabiashara haraka sana. Waambie: (1) Hakikisha pesa ya kutosha ipo kwenye akaunti ya simu — kiasi kinachohitajika ni Tsh ' + getCampaignTotalPrice(campaign.plan?.price_tzs ?? 0, campaign.plan?.geo_scope, campaign.target_wards).toLocaleString() + ', (2) Jaribu nambari nyingine ya simu ya mtandao tofauti, (3) Ikiwa tatizo linaendelea, wasiliana na timu ya usaidizi wa ' + failedPmts[0].provider + ' moja kwa moja.',
    })
  }

  if (pendingPmts.length > 0 && completedPmts.length === 0) {
    items.push({
      id: 'payment_pending', severity: 'warning',
      title: 'Malipo Yako Katika Hali ya Kusubiri Uthibitisho',
      explanation: `Kuna malipo yanayosubiri kuthibitishwa kupitia ${pendingPmts[0].provider}. Kawaida huchukua dakika 1-5 kupata uthibitisho. Ikiwa imechukua zaidi ya dakika 15, inaweza kuwa tatizo la webhook au API ya malipo haiisiliani na mfumo wetu vizuri.`,
      solution: 'Subiri dakika 5-10 kisha uburudishe ukurasa huu. Ikiwa hali haibadiliki, angalia logs za webhook katika Admin → Crons au seva logs. Unaweza pia kumuuliza mfanyabiashara kama walipokea ombi la malipo (pop-up) kwenye simu yao na kama walikubali au kukataa.',
    })
  }

  if (pmts.length === 0 && !['rejected', 'expired'].includes(campaign.status)) {
    items.push({
      id: 'no_payment', severity: 'info',
      title: 'Hakuna Jaribio la Malipo Bado',
      explanation: campaign.status === 'approved'
        ? 'Kampeni imeidhinishwa lakini mfanyabiashara bado hajajaribu kulipa. Kampeni haionekani kwa wateja. Inawezekana hawakupata taarifa ya kuidhinishwa, au wanasubiri kitu fulani.'
        : 'Kampeni bado haijapitia ukaguzi na malipo pia hayajaanza. Hii ni hali ya kawaida kabisa kwa kampeni mpya inayosubiri ukaguzi wa awali.',
      solution: campaign.status === 'approved'
        ? 'Tuma ukumbusho kwa mfanyabiashara sasa hivi kwa WhatsApp au barua pepe. Ujumbe: "Kampeni yako ya [jina] imeidhinishwa! Lipa sasa kupitia akaunti yako ili ianze kuonekana kwa wateja." Angalia mawasiliano yao katika kadi ya Mfanyabiashara hapo juu.'
        : 'Hakuna hatua zinazohitajika sasa. Mfanyabiashara atalipa baada ya kampeni kupitiwa na kuidhinishwa.',
    })
  }

  // ── Suspended campaign ─────────────────────────────────────────────────────
  if (campaign.status === 'suspended') {
    items.push({
      id: 'suspended', severity: 'warning',
      title: 'Kampeni Imesimamishwa — Haionekani kwa Wateja',
      explanation: `Kampeni imesimamishwa${campaign.admin_note ? ` kwa sababu hii iliyowekwa na admin: "${campaign.admin_note}"` : ' (sababu haikurekodiwa)'}. Tangazo halikuonekani kwa wateja wakati wote hali hii ipo. Mfanyabiashara anapoteza muda wa malipo yake.`,
      solution: `Hatua kabla ya kuamilisha: (1) Hakikisha mfanyabiashara ametatua tatizo lililofanya isimamishwe, (2) Angalia picha na maudhui ya tangazo kuhakikisha yanakidhi vigezo, (3) Ikiwa kila kitu iko sawa, bonyeza "Amilisha" ili kampeni ianze tena. ${!campaign.admin_note ? 'Pia, ingiza sababu ya kusimamishwa kwenye kumbuka ya admin ili historia iwe wazi.' : ''}`,
    })
  }

  // ── Rejected campaign ──────────────────────────────────────────────────────
  if (campaign.status === 'rejected') {
    items.push({
      id: 'rejected', severity: 'info',
      title: 'Kampeni Ilikataliwa',
      explanation: campaign.admin_note
        ? `Kampeni hii ilikataliwa na admin. Sababu iliyopewa: "${campaign.admin_note}". Mfanyabiashara anaweza kuunda kampeni mpya baada ya kutatua tatizo hili.`
        : 'Kampeni hii ilikataliwa lakini sababu haikuwekwa katika mfumo. Hii inaweza kuchanganya mfanyabiashara kwa sababu hawajui hasa ni nini kilichokwenda vibaya.',
      solution: !campaign.admin_note
        ? 'Sababu ya kukataa haikuwekwa — wasiliana na mfanyabiashara moja kwa moja kueleza tatizo halisi. Mfanyabiashara anayechanganyika anaweza kuacha huduma zetu. Daima weka sababu wazi wakati wa kukataa kampeni.'
        : 'Hakikisha mfanyabiashara amepokea taarifa ya kukataliwa (angalia ikiwa una WhatsApp/barua pepe yao hapo juu). Ikiwa hawakupata, wasiliana nao moja kwa moja na ueleze sababu na jinsi ya kuboresha kampeni yao.',
    })
  }

  // ── All good ───────────────────────────────────────────────────────────────
  if (items.length === 0) {
    items.push({
      id: 'ok', severity: 'success',
      title: 'Kampeni Iko Sawa — Hakuna Matatizo Yaliyopatikana',
      explanation: `Kampeni "${campaign.title}" iko katika hali nzuri. ${campaign.status === 'active' ? 'Inafanya kazi vizuri na inaonekana kwa wateja.' : 'Inaendelea vizuri bila matatizo yoyote yanayohitaji hatua ya haraka.'}`,
      solution: 'Hakuna hatua zinazohitajika kwa sasa. Endelea kufuatilia takwimu za kampeni ili kuhakikisha inafanya kazi vizuri na inafikia wateja wanaolengwa.',
    })
  }

  return items
}

// ── Severity UI config ─────────────────────────────────────────────────────────

const SEV_CFG: Record<Severity, { bg: string; border: string; icon: string; color: string; label: string }> = {
  critical: { bg: '#fef2f2', border: '#fecaca', icon: 'alert-circle',   color: '#dc2626', label: 'Tatizo Kubwa' },
  warning:  { bg: '#fffbeb', border: '#fde68a', icon: 'alert-triangle', color: '#d97706', label: 'Tahadhari'    },
  info:     { bg: '#eff6ff', border: '#bfdbfe', icon: 'info-circle',    color: '#2563eb', label: 'Taarifa'      },
  success:  { bg: '#f0fdf4', border: '#bbf7d0', icon: 'circle-check',   color: '#16a34a', label: 'Sawa'         },
}

function DiagnosticPanel({ campaign }: { campaign: Campaign }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const items     = runDiagnostics(campaign)
  const criticals = items.filter(i => i.severity === 'critical').length
  const warnings  = items.filter(i => i.severity === 'warning').length

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <i className="ti ti-microscope text-gray-500 text-base" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-700">Uchunguzi wa Kampeni</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {criticals > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {criticals} Makubwa
            </span>
          )}
          {warnings > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {warnings} Tahadhari
            </span>
          )}
          {criticals === 0 && warnings === 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              ✓ Sawa
            </span>
          )}
        </div>
      </div>

      {/* Diagnostic items */}
      <div className="p-4 space-y-2.5">
        {items.map(item => {
          const cfg  = SEV_CFG[item.severity]
          const open = expanded.has(item.id)
          return (
            <div
              key={item.id}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: cfg.border }}
            >
              {/* Summary row — always visible, clickable to expand */}
              <button
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: cfg.bg }}
              >
                <i className={`ti ti-${cfg.icon} text-base flex-shrink-0`} style={{ color: cfg.color }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: cfg.border, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
                <i
                  className={`ti ti-chevron-${open ? 'up' : 'down'} text-sm flex-shrink-0 transition-transform`}
                  style={{ color: cfg.color }}
                  aria-hidden="true"
                />
              </button>

              {/* Expanded detail */}
              {open && (
                <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: cfg.bg }}>
                  {/* Divider */}
                  <div className="h-px" style={{ background: cfg.border }} />

                  {/* Explanation */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: cfg.color }}>
                      <i className="ti ti-info-circle mr-1" aria-hidden="true" />Maelezo ya Tatizo
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.explanation}</p>
                  </div>

                  {/* Solution */}
                  <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${cfg.border}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: cfg.color }}>
                      <i className="ti ti-bulb mr-1" aria-hidden="true" />Jinsi ya Kutatua
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed">{item.solution}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
