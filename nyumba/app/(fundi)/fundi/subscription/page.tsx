'use client'
import { useEffect, useState } from 'react'

interface Plan {
  id: string; name: string; description: string | null
  price_tzs: number; billing_cycle: string; max_job_forms: number
  is_default: boolean
}

interface ActiveSub {
  id: string; plan_id: string; status: string
  starts_at: string | null; expires_at: string | null
  plan: { name: string; billing_cycle: string; max_job_forms: number } | null
}

const CYCLE_LABELS: Record<string, string> = {
  monthly:   'kila mwezi',
  quarterly: 'kila robo mwaka',
  annual:    'kila mwaka',
}

const PROVIDERS = [
  { value: 'mpesa',   label: 'M-Pesa' },
  { value: 'airtel',  label: 'Airtel Money' },
  { value: 'tigo',    label: 'Tigo Pesa' },
  { value: 'halopesa',label: 'HaloPesa' },
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysLeft(expires: string | null) {
  if (!expires) return null
  const diff = new Date(expires).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export default function FundiSubscriptionPage() {
  const [plans,      setPlans]      = useState<Plan[]>([])
  const [activeSub,  setActiveSub]  = useState<ActiveSub | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [msisdn,     setMsisdn]     = useState('')
  const [provider,   setProvider]   = useState('mpesa')
  const [paying,     setPaying]     = useState(false)
  const [success,    setSuccess]    = useState<{ payment_ref: string; amount: number } | null>(null)
  const [err,        setErr]        = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const subRes  = await fetch('/api/v1/fundi/subscription')
        const subData = await subRes.json()
        const activePlans = (subData.plans ?? []) as Plan[]
        setPlans(activePlans)
        setActiveSub(subData.subscription ?? null)
        // Pre-select default or first plan if no active sub
        if (!subData.subscription) {
          const def = activePlans.find(p => p.is_default) ?? activePlans[0]
          if (def) setSelectedId(def.id)
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function handlePay() {
    if (!selectedId) { setErr('Chagua mpango kwanza'); return }
    if (!msisdn.trim()) { setErr('Ingiza namba yako ya simu ya mobile money'); return }
    setPaying(true); setErr(null); setSuccess(null)
    try {
      const res  = await fetch('/api/v1/payments/fundi-subscription/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan_id: selectedId, msisdn: msisdn.trim(), provider }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Kuna tatizo. Jaribu tena.'); return }
      if (data.mock) {
        window.location.reload()
        return
      }
      setSuccess({ payment_ref: data.payment_ref, amount: data.amount })
    } catch { setErr('Haikuweza. Angalia muunganisho wako na ujaribu tena.') }
    finally { setPaying(false) }
  }

  const selectedPlan = plans.find(p => p.id === selectedId)
  const days = daysLeft(activeSub?.expires_at ?? null)
  const isExpiringSoon = days !== null && days <= 7 && days > 0

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usajili wa Fundi</h1>
        <p className="text-sm text-gray-500">Lipa usajili ili ujibu maombi ya kazi ya wateja</p>
      </div>

      {/* Active subscription banner */}
      {activeSub && activeSub.status === 'active' && (
        <div className={`rounded-2xl p-4 mb-6 flex items-start gap-3 ${isExpiringSoon ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpiringSoon ? 'bg-amber-100' : 'bg-green-100'}`}>
            <i className={`ti ti-${isExpiringSoon ? 'alert-triangle' : 'circle-check'} text-xl ${isExpiringSoon ? 'text-amber-600' : 'text-green-600'}`} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${isExpiringSoon ? 'text-amber-800' : 'text-green-800'}`}>
              {isExpiringSoon ? `Usajili Unaisha Hivi Karibuni — Siku ${days}` : 'Usajili Wako Uko Hai'}
            </p>
            <p className={`text-xs mt-0.5 ${isExpiringSoon ? 'text-amber-700' : 'text-green-700'}`}>
              Mpango: <strong>{activeSub.plan?.name ?? '—'}</strong> ·
              Fomu {activeSub.plan?.max_job_forms && activeSub.plan.max_job_forms >= 999 ? 'bila kikomo' : `${activeSub.plan?.max_job_forms}/mwezi`} ·
              Inaisha: {fmtDate(activeSub.expires_at)}
            </p>
          </div>
        </div>
      )}

      {activeSub && activeSub.status !== 'active' && (
        <div className="rounded-2xl p-4 mb-6 bg-red-50 border border-red-200 flex items-start gap-3">
          <i className="ti ti-alert-circle text-red-500 text-xl flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Usajili Wako Umeisha</p>
            <p className="text-xs text-red-700">Uliisha: {fmtDate(activeSub.expires_at)}. Fanya upya ili kuendelea kupata maombi ya kazi.</p>
          </div>
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-device-mobile text-2xl text-green-600" aria-hidden="true" />
          </div>
          <p className="font-bold text-green-800 text-base">Angalia Simu Yako!</p>
          <p className="text-sm text-green-700 mt-1">USSD popup inatumwa kwa namba yako ya mobile money.</p>
          <p className="text-xs text-green-600 mt-2">Kiasi: <strong>TZS {success.amount.toLocaleString()}</strong></p>
          <p className="text-[10px] text-green-500 mt-1 font-mono">Ref: {success.payment_ref}</p>
          <p className="text-xs text-green-700 mt-3">Baada ya kulipa, usajili utawashwa moja kwa moja. Unaweza kufunga ukurasa huu.</p>
        </div>
      )}

      {/* Plan selection */}
      {!success && plans.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Chagua Mpango</p>
          <div className="space-y-3 mb-6">
            {plans.map(plan => {
              const isSelected = selectedId === plan.id
              return (
                <button key={plan.id} onClick={() => setSelectedId(plan.id)}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{plan.name}</span>
                        {plan.is_default && (
                          <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
                            Maarufu
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-xs text-gray-500 mb-2 leading-relaxed">{plan.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <i className="ti ti-file-text text-xs" aria-hidden="true" />
                          {plan.max_job_forms >= 999 ? 'Fomu bila kikomo' : `Fomu ${plan.max_job_forms}/mwezi`}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ti ti-clock text-xs" aria-hidden="true" />
                          {CYCLE_LABELS[plan.billing_cycle] ?? plan.billing_cycle}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-primary-600 text-lg">TZS {plan.price_tzs.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">{CYCLE_LABELS[plan.billing_cycle] ?? plan.billing_cycle}</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 mt-3 flex items-center justify-center ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Payment form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Malipo ya Mobile Money</p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Mtoa Huduma</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(pv => (
                  <button key={pv.value} onClick={() => setProvider(pv.value)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition ${provider === pv.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {pv.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Namba ya Simu *</label>
              <input
                type="tel"
                value={msisdn}
                onChange={e => setMsisdn(e.target.value)}
                placeholder="0712 345 678"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-[10px] text-gray-400 mt-1">Format ya Tanzania: 07XXXXXXXX au 06XXXXXXXX</p>
            </div>

            {selectedPlan && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Jumla ya kulipa:</span>
                <span className="text-lg font-bold text-primary-600">TZS {selectedPlan.price_tzs.toLocaleString()}</span>
              </div>
            )}

            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

            <button onClick={handlePay} disabled={paying || !selectedId}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary-600 disabled:opacity-40 transition flex items-center justify-center gap-2">
              {paying ? (
                <><i className="ti ti-loader animate-spin" aria-hidden="true" /> Inatuma ombi...</>
              ) : (
                <><i className="ti ti-device-mobile" aria-hidden="true" /> Lipa Sasa</>
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-3">
              Malipo yanashughulikiwa salama kupitia AzamPay. Subiri USSD popup kwenye simu yako.
            </p>
          </div>
        </>
      )}

      {!success && plans.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-currency-dollar text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna mipango inayopatikana sasa hivi.</p>
          <p className="text-xs text-gray-400 mt-1">Wasiliana na NyumbaFasta kwa msaada.</p>
        </div>
      )}
    </div>
  )
}
