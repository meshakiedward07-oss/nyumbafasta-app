'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

type Campaign = {
  id: string; title: string; ad_type: string; status: string; payment_status: string
  plan: { name: string; price_tzs: number; duration_days: number } | null
}

const PAYMENT_METHODS = [
  { id: 'mpesa',     label: 'M-Pesa',       prefixes: ['074','075','076'], color: 'bg-red-50 border-red-200 text-red-700',    icon: '📱' },
  { id: 'airtel',    label: 'Airtel Money',  prefixes: ['068','069','078'], color: 'bg-orange-50 border-orange-200 text-orange-700', icon: '📱' },
  { id: 'tigo',      label: 'Tigo Pesa',     prefixes: ['065','067','071'], color: 'bg-blue-50 border-blue-200 text-blue-700',   icon: '📱' },
  { id: 'halopesa',  label: 'HaloPesa',      prefixes: ['062'],            color: 'bg-green-50 border-green-200 text-green-700', icon: '📱' },
]

const PROVIDER_PREFIXES: Record<string, string> = {
  '074': 'M-Pesa', '075': 'M-Pesa', '076': 'M-Pesa',
  '068': 'Airtel', '069': 'Airtel', '078': 'Airtel',
  '065': 'Tigo',   '067': 'Tigo',   '071': 'Tigo',
  '062': 'Halopesa',
}

function detectNetwork(phone: string): string {
  const p = phone.replace(/^(\+?255|0)/, '0')
  const prefix = p.slice(0, 3)
  return PROVIDER_PREFIXES[prefix] ?? 'M-Pesa'
}

export default function PayCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [campaign, setCampaign]   = useState<Campaign | null>(null)
  const [phone, setPhone]         = useState('')
  const [method, setMethod]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [polling, setPolling]     = useState(false)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [status, setStatus]       = useState<'idle' | 'sent' | 'done' | 'failed'>('idle')

  useEffect(() => {
    fetch(`/api/v1/advertising/campaigns/${id}`)
      .then(r => r.json())
      .then(d => setCampaign(d.campaign))
      .catch(() => setError('Kampeni haikupatikana'))
  }, [id])

  // Poll payment status
  useEffect(() => {
    if (!polling || !paymentId) return
    const t = setInterval(async () => {
      const res = await fetch(`/api/v1/advertising/pay/status/${paymentId}`)
      const d   = await res.json()
      if (d.payment?.status === 'completed') {
        clearInterval(t); setPolling(false); setStatus('done')
        setTimeout(() => router.push('/advertising/dashboard?paid=1'), 2000)
      } else if (d.payment?.status === 'failed') {
        clearInterval(t); setPolling(false); setStatus('failed')
        setError('Malipo yameshindwa. Hakikisha nambari ya simu ni sahihi na una salio la kutosha.')
      }
    }, 4000)
    return () => clearInterval(t)
  }, [polling, paymentId, router])

  async function initPay(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/v1/advertising/pay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, phone }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Kuna tatizo'); return }
      setPaymentId(d.payment_id)
      setStatus('sent')
      setPolling(true)
    } catch { setError('Haikuweza kuunganika. Jaribu tena.') }
    finally { setLoading(false) }
  }

  if (!campaign) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center text-gray-400">
        {error || 'Inapakia...'}
      </div>
    )
  }

  const plan = campaign.plan
  const network = detectNetwork(phone)

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💳</div>
          <h1 className="text-xl font-bold text-gray-800">Malipo ya Tangazo</h1>
          <p className="text-gray-500 text-sm mt-1">{campaign.title}</p>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
          {plan && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Mpango</span>
                <span className="font-medium text-gray-800">{plan.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Muda</span>
                <span className="font-medium text-gray-800">Siku {plan.duration_days}</span>
              </div>
              <div className="flex justify-between text-base border-t border-gray-200 pt-2 mt-2">
                <span className="font-bold text-gray-700">Jumla</span>
                <span className="font-bold text-primary-600 text-lg">
                  TZS {plan.price_tzs.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>

        {status === 'done' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-green-700">Malipo Yamefanikiwa!</h2>
            <p className="text-gray-500 text-sm mt-2">Tangazo lako linaendelea. Unabadilishwa...</p>
          </div>
        )}

        {status === 'sent' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3 animate-bounce">📱</div>
            <h2 className="text-lg font-bold text-gray-700">Angalia Simu Yako</h2>
            <p className="text-gray-500 text-sm mt-2">
              Ombi la malipo limetumwa kwa nambari <strong>{phone}</strong> kupitia <strong>{network}</strong>.
              Ingiza PIN yako kukamilisha malipo.
            </p>
            <div className="mt-4 flex justify-center gap-1">
              {[0,1,2].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full bg-primary-400 animate-pulse`} style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Inasubiri uthibitisho...</p>
          </div>
        )}

        {(status === 'idle' || status === 'failed') && (
          <form onSubmit={initPay} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            {/* Payment method selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chagua Njia ya Malipo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      method === m.id
                        ? 'border-primary-400 bg-primary-50 text-primary-700 ring-1 ring-primary-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span className="font-semibold text-xs">{m.label}</span>
                  </button>
                ))}
              </div>
              {method && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Nambari za {PAYMENT_METHODS.find(m2 => m2.id === method)?.label}:{' '}
                  {PAYMENT_METHODS.find(m2 => m2.id === method)?.prefixes.join(', ')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nambari ya Simu
              </label>
              <div className="relative">
                <input
                  required type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="0712345678"
                />
                {phone.length >= 4 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    {network}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Utapata ujumbe wa USSD kwenye simu hii kukuomba PIN yako.
              </p>
            </div>

            <button
              type="submit" disabled={loading || !method}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition disabled:opacity-50 text-sm"
            >
              {loading ? 'Inatuma Ombi...' : `Lipa TZS ${plan?.price_tzs.toLocaleString() ?? '—'} →`}
            </button>

            {!method && (
              <p className="text-xs text-center text-amber-600">Tafadhali chagua njia ya malipo kwanza.</p>
            )}

            <p className="text-xs text-center text-gray-400">
              Malipo yanafanywa kwa usalama kupitia AzamPay Tanzania
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
