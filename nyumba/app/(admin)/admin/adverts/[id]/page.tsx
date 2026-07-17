'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Payment = { id: string; amount: number; status: string; paid_at: string | null; provider: string; phone_number: string | null }
type Campaign = {
  id: string; title: string; ad_type: string; status: string; payment_status: string
  target_region: string; target_category: string | null; created_at: string; starts_at: string | null
  expires_at: string | null; admin_note: string | null; image_url: string | null; link_url: string | null
  creative_id: string | null
  advertiser: { id: string; business_name: string; contact_name: string; contact_phone: string; email: string; city: string; status: string } | null
  plan: { name: string; ad_type: string; price_tzs: number; duration_days: number } | null
  payments: Payment[]
}

const STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-700',
  approved:       'bg-blue-100 text-blue-700',
  active:         'bg-green-100 text-green-700',
  rejected:       'bg-red-100 text-red-700',
  suspended:      'bg-orange-100 text-orange-700',
  expired:        'bg-gray-100 text-gray-600',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading]   = useState(true)
  const [reason, setReason]     = useState('')
  const [acting, setActing]     = useState(false)
  const [toast, setToast]       = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/v1/admin/adverts/${id}`)
      .then(r => r.json())
      .then(d => { setCampaign(d.campaign ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function doAction(action: 'approve' | 'reject' | 'suspend' | 'activate') {
    setActing(true)
    const res = await fetch(`/api/v1/admin/adverts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason || undefined }),
    })
    const d = await res.json()
    if (res.ok) {
      setCampaign(d.campaign ?? null)
      setToast(`Imefanikiwa`)
      setReason('')
      setTimeout(() => setToast(null), 3000)
    } else {
      setToast(`Hitilafu: ${d.error}`)
    }
    setActing(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Inapakia...</div>
  if (!campaign) return (
    <div className="p-8 text-center">
      <p className="text-gray-500 mb-4">Kampeni haikupatikana</p>
      <Link href="/admin/adverts" className="text-primary-600 text-sm hover:underline">← Rudi kwenye orodha</Link>
    </div>
  )

  const adv = campaign.advertiser
  const plan = campaign.plan

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <i className="ti ti-arrow-left text-xl" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">{campaign.title}</h1>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {campaign.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Campaign info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 mb-2">Taarifa za Kampeni</h2>
        <Row label="Aina" value={campaign.ad_type} />
        <Row label="Mkoa" value={campaign.target_region} />
        {campaign.target_category && <Row label="Kategoria" value={campaign.target_category} />}
        <Row label="Malipo" value={campaign.payment_status} />
        {campaign.starts_at && <Row label="Ilianza" value={new Date(campaign.starts_at).toLocaleDateString('sw')} />}
        {campaign.expires_at && <Row label="Inaisha" value={new Date(campaign.expires_at).toLocaleDateString('sw')} />}
        {campaign.link_url && <Row label="Link" value={campaign.link_url} />}
        {campaign.creative_id
          ? <Row label="Creative" value="✅ Imepakiwa" />
          : <Row label="Creative" value="⚠️ Haijapakiwa bado" />
        }
        {campaign.image_url && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Picha ya Tangazo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={campaign.image_url} alt="Ad" className="rounded-xl max-h-48 object-contain border border-gray-100" />
          </div>
        )}
        {campaign.admin_note && (
          <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
            <strong>Kumbuka (Admin):</strong> {campaign.admin_note}
          </div>
        )}
      </div>

      {/* Advertiser info */}
      {adv && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Mfanyabiashara</h2>
          <Row label="Biashara" value={adv.business_name} />
          <Row label="Jina" value={adv.contact_name} />
          <Row label="Simu" value={adv.contact_phone} />
          <Row label="Email" value={adv.email} />
          <Row label="Mji" value={adv.city} />
        </div>
      )}

      {/* Plan info */}
      {plan && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Mpango</h2>
          <Row label="Jina" value={plan.name} />
          <Row label="Bei" value={`Tsh ${plan.price_tzs.toLocaleString()}`} />
          <Row label="Muda" value={`Siku ${plan.duration_days}`} />
        </div>
      )}

      {/* Payments */}
      {campaign.payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Malipo</h2>
          <div className="space-y-2">
            {campaign.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{p.provider} — {p.phone_number ?? 'N/A'}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Tsh {p.amount.toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-700">Hatua</h2>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Sababu (ya kukataa/kusimamisha) — optional"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <div className="flex gap-2 flex-wrap">
          {campaign.status === 'pending_review' && (
            <>
              <button
                onClick={() => doAction('approve')}
                disabled={acting}
                className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-50"
              >
                {acting ? '...' : '✅ Idhinisha'}
              </button>
              <button
                onClick={() => doAction('reject')}
                disabled={acting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {acting ? '...' : '❌ Kataa'}
              </button>
            </>
          )}
          {campaign.status === 'active' && (
            <button
              onClick={() => doAction('suspend')}
              disabled={acting}
              className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              {acting ? '...' : '⏸ Simamisha'}
            </button>
          )}
          {(campaign.status === 'suspended' || campaign.status === 'approved') && (
            <button
              onClick={() => doAction('activate')}
              disabled={acting}
              className="flex-1 bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-50"
            >
              {acting ? '...' : '▶ Amilisha'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}
