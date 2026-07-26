'use client'
import { useEffect, useState } from 'react'
import type { SubscriptionPlan, OrganizationSubscription, SubscriptionStatus, PlanFeatures } from '@/lib/types/property'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return n === 0 ? 'Bila Malipo' : `Tsh ${n.toLocaleString()}` }

function daysLeft(isoDate: string | null): number | null {
  if (!isoDate) return null
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusInfo(status: SubscriptionStatus, trialEndsAt: string | null, periodEnd: string | null) {
  const trialDays  = daysLeft(trialEndsAt)
  const periodDays = daysLeft(periodEnd)
  switch (status) {
    case 'trial':
      return {
        color: 'bg-blue-50 border-blue-200 text-blue-700',
        icon:  'ti-clock',
        label: 'Kipindi cha Majaribio',
        detail: trialDays != null && trialDays >= 0
          ? `Siku ${trialDays} zimesalia`
          : 'Majaribio yamekwisha',
      }
    case 'active':
      return {
        color: 'bg-green-50 border-green-200 text-green-700',
        icon:  'ti-check-circle',
        label: 'Usajili Hai',
        detail: periodDays != null ? `Inaisha ${dateFmt(periodEnd)}` : '',
      }
    case 'past_due':
      return {
        color: 'bg-amber-50 border-amber-200 text-amber-700',
        icon:  'ti-alert-circle',
        label: 'Malipo Yamechelewa',
        detail: 'Wasiliana na msaada kufanya malipo',
      }
    case 'grace_period':
      return {
        color: 'bg-orange-50 border-orange-200 text-orange-700',
        icon:  'ti-hourglass',
        label: 'Muda wa Neema',
        detail: 'Fanya malipo haraka kabla huduma hazijasimamishwa',
      }
    case 'cancelled':
      return {
        color: 'bg-gray-50 border-gray-200 text-gray-600',
        icon:  'ti-x-circle',
        label: 'Imesimamishwa',
        detail: 'Shirika limefungwa. Wasiliana nasi kulifungua.',
      }
    case 'expired':
      return {
        color: 'bg-red-50 border-red-200 text-red-600',
        icon:  'ti-calendar-x',
        label: 'Imekwisha',
        detail: 'Upya usajili ili kuendelea kutumia huduma zote',
      }
  }
}

const FEATURE_LABELS: [keyof PlanFeatures, string, string][] = [
  ['max_properties',             'Mali',                           'building'  ],
  ['max_units',                  'Vitengo',                        'layout'    ],
  ['max_members',                'Wanachama wa Timu',              'users'     ],
  ['has_reports',                'Ripoti na Takwimu',              'chart-bar' ],
  ['has_maintenance',            'Usimamizi wa Matengenezo',       'tool'      ],
  ['has_communication_hub',      'Mazungumzo',                     'message'   ],
  ['has_vendor_directory',       'Saraka ya Wazabuni',             'address-book'],
  ['has_staff_assisted_listing', 'Usaidizi wa Kutangaza',          'headset'   ],
  ['has_priority_support',       'Msaada wa Kipaumbele',           'star'      ],
]

function PlanCard({ plan, current, onSelect }: {
  plan: SubscriptionPlan
  current: boolean
  onSelect: (p: SubscriptionPlan) => void
}) {
  const f = plan.features
  return (
    <div className={`bg-white rounded-2xl border-2 p-5 flex flex-col gap-4 transition ${current ? 'border-primary-500 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
      {current && (
        <span className="text-xs bg-primary-500 text-white px-2.5 py-1 rounded-full font-semibold w-fit">Mpango Wako</span>
      )}
      <div>
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
        <p className="text-2xl font-bold text-primary-600 mt-2">
          {fmt(plan.price_tzs)}
          {plan.price_tzs > 0 && (
            <span className="text-sm font-normal text-gray-400 ml-1">
              /{plan.billing_cycle === 'monthly' ? 'mwezi' : plan.billing_cycle === 'quarterly' ? 'robo mwaka' : 'mwaka'}
            </span>
          )}
        </p>
      </div>

      <ul className="space-y-2 flex-1">
        {FEATURE_LABELS.map(([key, label, icon]) => {
          const val = f[key]
          const isNum  = ['max_properties', 'max_units', 'max_members'].includes(key)
          const isOn   = !isNum && !!val
          const isOff  = !isNum && !val
          return (
            <li key={key} className={`flex items-center gap-2 text-sm ${isOff ? 'text-gray-300' : 'text-gray-700'}`}>
              <i className={`ti ti-${icon} text-base ${isOn ? 'text-primary-500' : isOff ? 'text-gray-200' : 'text-primary-500'}`} aria-hidden="true" />
              {isNum ? (
                <span><strong>{val === -1 ? '∞' : val}</strong> {label}</span>
              ) : (
                <span>{label}</span>
              )}
              {isOn && <i className="ti ti-check text-green-500 ml-auto text-xs" />}
              {isOff && <i className="ti ti-x text-gray-200 ml-auto text-xs" />}
            </li>
          )
        })}
      </ul>

      {!current && (
        <button
          onClick={() => onSelect(plan)}
          className="w-full py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
        >
          {plan.price_tzs === 0 ? 'Chagua Mpango Huu' : 'Panda Mpango Huu'}
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsajiliPage() {
  const [orgId,       setOrgId]       = useState<string | null>(null)
  const [sub,         setSub]         = useState<OrganizationSubscription | null>(null)
  const [plans,       setPlans]       = useState<SubscriptionPlan[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [whatsappUrl] = useState('https://wa.me/255000000000') // replace with real number from config

  useEffect(() => {
    async function load() {
      try {
        const orgRes = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        if (!orgData.organizations?.length) return
        const primary = orgData.organizations.find((o: { role: string }) => o.role === 'owner') ?? orgData.organizations[0]
        const id = primary.organization.id as string
        setOrgId(id)

        const subRes  = await fetch(`/api/v1/organizations/${id}/subscription`)
        const subData = await subRes.json()
        setSub(subData.subscription)
        setPlans(subData.plans ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Huna shirika bado</p>
        </div>
      </div>
    )
  }

  const status    = sub?.status
  const planName  = (sub?.plan as SubscriptionPlan | null)?.name ?? 'Bila Mpango'
  const statusI   = status ? statusInfo(status, sub?.trial_ends_at ?? null, sub?.current_period_end ?? null) : null
  const currentId = (sub?.plan as SubscriptionPlan | null)?.id ?? null

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Usajili Wangu</h1>
        <p className="text-sm text-gray-500 mt-0.5">Mpango na huduma za shirika lako</p>
      </div>

      {/* Current subscription banner */}
      {statusI && sub && (
        <div className={`rounded-2xl border-2 p-5 mb-6 flex items-start gap-4 ${statusI.color}`}>
          <i className={`ti ${statusI.icon} text-3xl flex-shrink-0 mt-0.5`} aria-hidden="true" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg">{planName}</p>
              <span className="text-sm font-medium opacity-80">{statusI.label}</span>
            </div>
            <p className="text-sm mt-0.5 opacity-80">{statusI.detail}</p>
            {sub.pending_plan_id && (
              <p className="text-xs mt-1.5 opacity-70">
                <i className="ti ti-clock" /> Mpango utabadilika {dateFmt(sub.pending_plan_starts_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {!sub && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
          <p className="font-medium text-amber-700">Huna usajili unaoendelea</p>
          <p className="text-sm text-amber-600 mt-1">Chagua mpango hapa chini au wasiliana nasi kupitia WhatsApp.</p>
        </div>
      )}

      {/* Plans grid */}
      {plans.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Mipango Inayopatikana</h2>
          <div className={`grid gap-4 ${plans.length === 1 ? '' : plans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {plans.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                current={p.id === currentId}
                onSelect={setSelectedPlan}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upgrade request modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <i className="ti ti-package text-4xl text-primary-500" aria-hidden="true" />
            <h2 className="text-lg font-bold text-gray-900 mt-3 mb-1">
              Ombi la Kubadilisha Mpango
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Unataka kubadilisha kwenda mpango wa <strong>{selectedPlan.name}</strong> ({fmt(selectedPlan.price_tzs)}/mwezi).
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Kwa sasa, mabadiliko ya mpango yanafanywa kwa mkono na timu yetu.
              Wasiliana nasi kupitia WhatsApp na tutakusaidia haraka iwezekanavyo.
            </p>
            <div className="space-y-2">
              <a
                href={`${whatsappUrl}?text=${encodeURIComponent(`Habari! Nataka kubadilisha mpango wangu kwenda ${selectedPlan.name} (Tsh ${selectedPlan.price_tzs.toLocaleString()}/mwezi). Shirika langu ID: ${orgId}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-600 transition"
              >
                <i className="ti ti-brand-whatsapp text-lg" aria-hidden="true" />
                Wasiliana Nasi WhatsApp
              </a>
              <button
                onClick={() => setSelectedPlan(null)}
                className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50"
              >
                Funga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
