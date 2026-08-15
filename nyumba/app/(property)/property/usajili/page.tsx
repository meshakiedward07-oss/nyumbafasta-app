'use client'
import { useEffect, useState, useCallback } from 'react'
import type {
  SubscriptionPlan, OrganizationSubscription, SubscriptionStatus,
  PlanFeatures, SubscriptionInvoice, InvoiceStatus,
} from '@/lib/types/property'
import { useLanguage } from '@/lib/i18n/context'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number, freeLabel = 'Bila Malipo') { return n === 0 ? freeLabel : `Tsh ${n.toLocaleString()}` }

function daysLeft(isoDate: string | null): number | null {
  if (!isoDate) return null
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function statusInfo(status: SubscriptionStatus, trialEndsAt: string | null, periodEnd: string | null, t: (k: string) => string): { label: string; color: string; icon: string; detail: string } {
  const td = daysLeft(trialEndsAt)
  const pd = daysLeft(periodEnd)
  switch (status) {
    case 'trial':
      return { color: 'bg-blue-50 border-blue-200 text-blue-700', icon: 'ti-clock', label: t('pr_usajili_status_trial'),
               detail: td != null && td >= 0 ? `Siku ${td} ${t('pr_usajili_days_left')}` : t('pr_usajili_trial_ended') }
    case 'active':
      return { color: 'bg-green-50 border-green-200 text-green-700', icon: 'ti-check-circle', label: t('pr_usajili_status_active'),
               detail: pd != null ? `${t('pr_usajili_expires_on')} ${dateFmt(periodEnd)}` : '' }
    case 'past_due':
      return { color: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'ti-alert-circle', label: t('pr_usajili_status_past_due'),
               detail: t('pr_usajili_past_due_detail') }
    case 'grace_period':
      return { color: 'bg-orange-50 border-orange-200 text-orange-700', icon: 'ti-hourglass', label: t('pr_usajili_status_grace'),
               detail: t('pr_usajili_grace_detail') }
    case 'cancelled':
      return { color: 'bg-gray-50 border-gray-200 text-gray-600', icon: 'ti-x-circle', label: t('pr_usajili_status_cancelled'),
               detail: t('pr_usajili_cancelled_detail') }
    case 'expired':
      return { color: 'bg-red-50 border-red-200 text-red-600', icon: 'ti-calendar-x', label: t('pr_usajili_status_expired'),
               detail: t('pr_usajili_expired_detail') }
  }
}

const CYCLE_LABEL: Record<string, string> = {
  monthly: 'mwezi', quarterly: 'robo mwaka', annual: 'mwaka',
}

const FEATURE_LABELS: [keyof PlanFeatures, string, string][] = [
  ['max_properties',             'Mali',                      'building'     ],
  ['max_units',                  'Vitengo',                   'layout'       ],
  ['max_members',                'Wanachama wa Timu',         'users'        ],
  ['has_reports',                'Ripoti na Takwimu',         'chart-bar'    ],
  ['has_maintenance',            'Usimamizi wa Matengenezo',  'tool'         ],
  ['has_communication_hub',      'Mazungumzo',                'message'      ],
  ['has_vendor_directory',       'Saraka ya Wazabuni',        'address-book' ],
  ['has_staff_assisted_listing', 'Usaidizi wa Kutangaza',     'headset'      ],
  ['has_priority_support',       'Msaada wa Kipaumbele',      'star'         ],
]

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, current, onSelect }: {
  plan: SubscriptionPlan
  current: boolean
  onSelect: (p: SubscriptionPlan) => void
}) {
  const { t } = useLanguage()
  const f = plan.features
  return (
    <div className={`bg-white rounded-2xl border-2 p-5 flex flex-col gap-4 transition ${current ? 'border-primary-500 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
      {current && <span className="text-xs bg-primary-500 text-white px-2.5 py-1 rounded-full font-semibold w-fit">{t('pr_usajili_current_plan')}</span>}
      <div>
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
        <p className="text-2xl font-bold text-primary-600 mt-2">
          {fmt(plan.price_tzs)}
          {plan.price_tzs > 0 && <span className="text-sm font-normal text-gray-400 ml-1">/{CYCLE_LABEL[plan.billing_cycle]}</span>}
        </p>
      </div>
      <ul className="space-y-2 flex-1">
        {FEATURE_LABELS.map(([key, label, icon]) => {
          const val   = f[key]
          const isNum = ['max_properties', 'max_units', 'max_members'].includes(key)
          const isOn  = !isNum && !!val
          const isOff = !isNum && !val
          return (
            <li key={key} className={`flex items-center gap-2 text-sm ${isOff ? 'text-gray-300' : 'text-gray-700'}`}>
              <i className={`ti ti-${icon} text-base ${isOn ? 'text-primary-500' : isOff ? 'text-gray-200' : 'text-primary-500'}`} aria-hidden="true" />
              {isNum ? <span><strong>{val === -1 ? '∞' : val}</strong> {label}</span> : <span>{label}</span>}
              {isOn  && <i className="ti ti-check text-green-500 ml-auto text-xs" />}
              {isOff && <i className="ti ti-x text-gray-200 ml-auto text-xs" />}
            </li>
          )
        })}
      </ul>
      {!current && (
        <button onClick={() => onSelect(plan)} className="w-full py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
          {plan.price_tzs === 0 ? t('pr_usajili_select_plan') : t('pr_usajili_upgrade_plan')}
        </button>
      )}
    </div>
  )
}

// ── AzamPay payment modal ─────────────────────────────────────────────────────

type PayStep = 'form' | 'pending' | 'done'

function PaymentModal({ plan, orgId, onPaid, onClose }: {
  plan: SubscriptionPlan
  orgId: string
  onPaid: (inv: SubscriptionInvoice) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const cycles: { v: string; label: string; multiplier: number }[] = [
    { v: 'monthly',   label: t('pr_usajili_monthly'),              multiplier: 1  },
    { v: 'quarterly', label: t('pr_usajili_quarterly'),            multiplier: 3  },
    { v: 'annual',    label: `${t('pr_usajili_annual')} (10% punguzo)`, multiplier: 10 },
  ]
  const [cycle,     setCycle]     = useState('monthly')
  const [msisdn,    setMsisdn]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [step,      setStep]      = useState<PayStep>('form')
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)

  const multiplier = cycles.find(c => c.v === cycle)?.multiplier ?? 1
  const total = plan.price_tzs * multiplier

  async function submit() {
    if (!msisdn.trim()) { setError(t('pr_usajili_phone_label')); return }
    setSaving(true); setError(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/subscription/pay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: plan.id, billing_cycle: cycle, msisdn: msisdn.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? t('pr_err_generic')); setSaving(false); return }
    setInvoiceId(data.invoice_id)
    setStep('pending')
    setSaving(false)
  }

  // Poll for invoice confirmation every 5 seconds (max ~2 min)
  useEffect(() => {
    if (step !== 'pending' || !invoiceId || pollCount >= 24) return
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/v1/organizations/${orgId}/invoices`)
        const data = await res.json()
        const inv: SubscriptionInvoice | undefined = (data.invoices ?? []).find((i: SubscriptionInvoice) => i.id === invoiceId)
        if (inv?.status === 'confirmed') { setStep('done'); onPaid(inv) }
        else if (inv?.status === 'void') { setStep('form'); setError('Malipo yalikataliwa. Jaribu tena.') }
        else setPollCount(c => c + 1)
      } catch { setPollCount(c => c + 1) }
    }, 5000)
    return () => clearTimeout(t)
  }, [step, invoiceId, pollCount, orgId, onPaid])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">

        {step === 'form' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('pr_usajili_pay_heading')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('pr_usajili_upgrade_to')} <strong>{plan.name}</strong></p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_usajili_cycle_duration')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {cycles.map(c => (
                    <button key={c.v} type="button" onClick={() => setCycle(c.v)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border-2 transition text-center ${cycle === c.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-primary-50 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-primary-700">{plan.name} × {multiplier} {multiplier === 1 ? 'mwezi' : 'miezi'}</span>
                <span className="font-bold text-primary-800 text-lg">{fmt(total)}</span>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_usajili_phone_label')} *</label>
                <input
                  type="tel"
                  value={msisdn}
                  onChange={e => setMsisdn(e.target.value)}
                  placeholder={t('pr_usajili_phone_ph')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <p className="text-xs text-gray-400 mt-1">{t('pr_usajili_mpesa_hint')}</p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button onClick={submit} disabled={saving}
                  className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                  {saving ? t('pr_usajili_paying') : `${t('pr_usajili_pay')} ${fmt(total, t('pr_usajili_free'))}`}
                </button>
                <button onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">{t('pr_cancel')}</button>
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                {t('pr_usajili_ussd_popup')}
              </p>
            </div>
          </>
        )}

        {step === 'pending' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-phone-calling text-primary-500 text-3xl animate-pulse" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t('pr_usajili_pending_title')}</h2>
            <p className="text-sm text-gray-500 mb-1">{t('pr_usajili_pending_desc1')}</p>
            <p className="text-sm text-gray-500 mb-6">{t('pr_usajili_pending_desc2')}</p>
            <div className="flex justify-center gap-1 mb-6">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            {pollCount >= 24 && (
              <div className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3 mb-4">
                {t('pr_usajili_timeout_msg')}
              </div>
            )}
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">{t('pr_usajili_close_note')}</button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-check text-green-500 text-3xl" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t('pr_usajili_done_title')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('pr_usajili_done_msg').replace('{plan}', plan.name)}</p>
            <button onClick={onClose}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              {t('pr_usajili_ok_dashboard')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Proof upload modal ────────────────────────────────────────────────────────

function ProofModal({ invoice, orgId, onUpdated, onClose }: {
  invoice: SubscriptionInvoice
  orgId: string
  onUpdated: (inv: SubscriptionInvoice) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [url,    setUrl]    = useState(invoice.proof_url ?? '')
  const [note,   setNote]   = useState(invoice.proof_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function submit() {
    setSaving(true); setError(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/invoices/${invoice.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_url: url.trim(), proof_note: note.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? t('pr_err_generic')); setSaving(false); return }
    onUpdated(data.invoice)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('pr_usajili_proof_modal_title')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ankara ya <strong>{fmt(invoice.amount_tzs, t('pr_usajili_free'))}</strong>
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_usajili_proof_img_label')}</label>
            <input value={url} onChange={e => setUrl(e.target.value)} type="url"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder={t('pr_usajili_proof_img_ph')} />
            <p className="text-xs text-gray-400 mt-1">{t('pr_usajili_proof_img_hint')}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_usajili_txn_label')}</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder={t('pr_usajili_txn_ph')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving || !url.trim()}
              className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40">
              {saving ? t('pr_usajili_uploading') : t('pr_usajili_submit_proof')}
            </button>
            <button onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">{t('pr_close')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Invoices tab ──────────────────────────────────────────────────────────────

function InvoicesTab({ orgId, invoices, loading, onProofUploaded }: {
  orgId: string
  invoices: SubscriptionInvoice[]
  loading: boolean
  onProofUploaded: (inv: SubscriptionInvoice) => void
}) {
  const { t } = useLanguage()
  const [proofFor, setProofFor] = useState<SubscriptionInvoice | null>(null)

  const INVOICE_STATUS_LABELS: Record<InvoiceStatus, { label: string; cls: string }> = {
    pending:        { label: t('pr_usajili_invoice_pending'),   cls: 'bg-amber-50 text-amber-700'  },
    proof_uploaded: { label: t('pr_usajili_invoice_proof'),     cls: 'bg-blue-50 text-blue-700'    },
    confirmed:      { label: t('pr_usajili_invoice_confirmed'), cls: 'bg-green-50 text-green-700'  },
    void:           { label: t('pr_usajili_invoice_void'),      cls: 'bg-gray-100 text-gray-400'   },
  }

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
  )

  if (invoices.length === 0) return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <i className="ti ti-receipt text-5xl text-gray-200" aria-hidden="true" />
      <p className="text-gray-500 font-medium mt-3">{t('pr_usajili_invoice_empty')}</p>
      <p className="text-sm text-gray-400 mt-1">{t('pr_usajili_inv_empty_desc2')}</p>
    </div>
  )

  return (
    <>
      {proofFor && (
        <ProofModal
          invoice={proofFor}
          orgId={orgId}
          onUpdated={inv => { onProofUploaded(inv); setProofFor(null) }}
          onClose={() => setProofFor(null)}
        />
      )}
      <div className="space-y-3">
        {invoices.map(inv => {
          const s = INVOICE_STATUS_LABELS[inv.status]
          const plan = inv.plan as SubscriptionPlan | null
          // AzamPay invoices have payment_reference set — no manual proof needed
          const isAzamPay  = !!inv.payment_reference
          const canUpload  = !isAzamPay && (inv.status === 'pending' || inv.status === 'proof_uploaded')
          return (
            <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{plan?.name ?? 'Ankara'}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    {isAzamPay && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">Mobile Money</span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-primary-600 mt-1">{fmt(inv.amount_tzs)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {CYCLE_LABEL[inv.billing_cycle] ?? inv.billing_cycle} · Tarehe: {dateFmt(inv.created_at)}
                    {inv.due_date && ` · Malipo: ${dateFmt(inv.due_date)}`}
                  </p>
                  {isAzamPay && inv.status === 'pending' && (
                    <p className="text-xs text-blue-600 mt-1">
                      <i className="ti ti-clock" /> {t('pr_usajili_inv_awaiting')}
                    </p>
                  )}
                  {inv.proof_url && inv.status === 'proof_uploaded' && (
                    <p className="text-xs text-blue-600 mt-1">
                      <i className="ti ti-check" /> {t('pr_usajili_inv_proof_wait')}
                    </p>
                  )}
                  {inv.status === 'confirmed' && (
                    <p className="text-xs text-green-600 mt-1">
                      <i className="ti ti-check-circle" /> {t('pr_usajili_confirmed_on')} · {dateFmt(inv.confirmed_at)}
                    </p>
                  )}
                  {inv.status === 'void' && inv.void_reason && (
                    <p className="text-xs text-gray-400 mt-1">{t('pr_usajili_inv_void_reason')}: {inv.void_reason}</p>
                  )}
                </div>
                {canUpload && (
                  <button onClick={() => setProofFor(inv)}
                    className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 transition flex-shrink-0">
                    {inv.proof_url ? t('pr_usajili_update_proof') : t('pr_usajili_upload_proof_btn')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['trial', 'active', 'past_due', 'grace_period'])
const FREE_LIMITS = { max_properties: 2, max_units: 5, max_members: 2 }

function UsageBar({ label, current, max, icon }: { label: string; current: number; max: number; icon: string }) {
  const pct    = max === -1 ? 0 : Math.min(100, Math.round((current / max) * 100))
  const isOver = max !== -1 && current >= max
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <i className={`ti ti-${icon} text-sm text-gray-400`} aria-hidden="true" />
          <span className="text-xs text-gray-600 font-medium">{label}</span>
        </div>
        <span className={`text-xs font-bold tabular-nums ${isOver ? 'text-red-600' : 'text-gray-800'}`}>
          {current} / {max === -1 ? '∞' : max}
        </span>
      </div>
      {max !== -1 && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-primary-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

type Tab = 'mpango' | 'ankara'
type Usage = { properties: number; units: number; members: number }

export default function UsajiliPage() {
  const { t } = useLanguage()
  const [orgId,    setOrgId]    = useState<string | null>(null)
  const [sub,      setSub]      = useState<OrganizationSubscription | null>(null)
  const [plans,    setPlans]    = useState<SubscriptionPlan[]>([])
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([])
  const [usage,    setUsage]    = useState<Usage | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [invLoad,  setInvLoad]  = useState(false)
  const [tab,      setTab]      = useState<Tab>('mpango')
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null)

  // Cancellation state
  const [showCancel,  setShowCancel]  = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling,  setCancelling]  = useState(false)
  const [cancelMsg,   setCancelMsg]   = useState<string | null>(null)
  const [cancelErr,   setCancelErr]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        if (!orgData.organizations?.length) return
        const primary = orgData.organizations.find((o: { role: string }) => o.role === 'owner') ?? orgData.organizations[0]
        const id = primary.organization.id as string
        setOrgId(id)

        const [subRes, invRes] = await Promise.all([
          fetch(`/api/v1/organizations/${id}/subscription`),
          fetch(`/api/v1/organizations/${id}/invoices`),
        ])
        const [subData, invData] = await Promise.all([subRes.json(), invRes.json()])
        setSub(subData.subscription)
        setPlans(subData.plans ?? [])
        setUsage(subData.usage ?? null)
        setInvoices(invData.invoices ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const loadInvoices = useCallback(async () => {
    if (!orgId) return
    setInvLoad(true)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/invoices`)
      const data = await res.json()
      setInvoices(data.invoices ?? [])
    } catch { /* silent */ }
    finally { setInvLoad(false) }
  }, [orgId])

  function handlePaymentDone(inv: SubscriptionInvoice) {
    setInvoices(prev => [inv, ...prev.filter(i => i.id !== inv.id)])
    setSelected(null)
    setTab('ankara')
    // Refresh subscription data to show updated status
    if (orgId) {
      fetch(`/api/v1/organizations/${orgId}/subscription`)
        .then(r => r.json())
        .then(d => { setSub(d.subscription); setUsage(d.usage ?? null) })
        .catch(() => {})
    }
  }

  function handleProofUploaded(updated: SubscriptionInvoice) {
    setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  if (loading) return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)}
    </div>
  )

  if (!orgId) return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
        <p className="text-gray-500 font-medium mt-3">{t('pr_usajili_no_org')}</p>
      </div>
    </div>
  )

  const status   = sub?.status
  const planObj  = sub?.plan as SubscriptionPlan | null
  const planName = planObj?.name ?? t('pr_usajili_no_plan')
  const statusI  = status ? statusInfo(status, sub?.trial_ends_at ?? null, sub?.current_period_end ?? null, t as (k: string) => string) : null
  const currentId = planObj?.id ?? null

  const pendingCount = invoices.filter(i => i.status === 'pending' || i.status === 'proof_uploaded').length

  // Effective limits — use plan features when status is active-like, otherwise FREE_LIMITS
  const isActiveSub = status ? ACTIVE_STATUSES.has(status) : false
  const planFeatures = planObj?.features as PlanFeatures | null
  const limits = {
    max_properties: isActiveSub ? (planFeatures?.max_properties ?? FREE_LIMITS.max_properties) : FREE_LIMITS.max_properties,
    max_units:      isActiveSub ? (planFeatures?.max_units      ?? FREE_LIMITS.max_units)      : FREE_LIMITS.max_units,
    max_members:    isActiveSub ? (planFeatures?.max_members    ?? FREE_LIMITS.max_members)     : FREE_LIMITS.max_members,
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {selected && orgId && (
        <PaymentModal plan={selected} orgId={orgId} onPaid={handlePaymentDone} onClose={() => setSelected(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('pr_usajili_my_title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('pr_usajili_plan_subtitle')}</p>
      </div>

      {/* Status banner */}
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
                <i className="ti ti-clock" /> {t('pr_usajili_plan_pending')} {dateFmt(sub.pending_plan_starts_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Usage widget */}
      {usage && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <i className="ti ti-chart-bar text-primary-500 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900 text-sm">{t('pr_usajili_usage_title')}</h2>
          </div>
          <div className="space-y-4">
            <UsageBar label={t('pr_usajili_usage_mali')}    current={usage.properties} max={limits.max_properties} icon="building"  />
            <UsageBar label={t('pr_usajili_usage_units')}   current={usage.units}      max={limits.max_units}      icon="layout"    />
            <UsageBar label={t('pr_usajili_usage_members')} current={usage.members}    max={limits.max_members}    icon="users"     />
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 w-fit">
        <button onClick={() => setTab('mpango')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === 'mpango' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('pr_usajili_tab_plans')}
        </button>
        <button onClick={() => { setTab('ankara'); loadInvoices() }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === 'ankara' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('pr_usajili_tab_invoices')}
          {pendingCount > 0 && (
            <span className="bg-amber-400 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mipango tab ── */}
      {tab === 'mpango' && plans.length > 0 && (
        <div className={`grid gap-4 ${plans.length === 1 ? '' : plans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {plans.map(p => (
            <PlanCard key={p.id} plan={p} current={p.id === currentId} onSelect={setSelected} />
          ))}
        </div>
      )}

      {tab === 'mpango' && plans.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-package text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">{t('pr_usajili_no_plans')}</p>
        </div>
      )}

      {/* ── Ankara tab ── */}
      {tab === 'ankara' && (
        <InvoicesTab
          orgId={orgId}
          invoices={invoices}
          loading={invLoad}
          onProofUploaded={handleProofUploaded}
        />
      )}

      {/* ── Danger zone: cancel subscription ── */}
      {sub && ['trial', 'active', 'past_due', 'grace_period'].includes(sub.status) && (
        <div className="mt-10 pt-6 border-t border-gray-100">
          {sub.cancelled_at ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
              <i className="ti ti-info-circle text-gray-400 text-lg flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-gray-700">{t('pr_usajili_cancel_scheduled_chip')}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('pr_usajili_cancel_when')} {sub.current_period_end
                    ? new Date(sub.current_period_end).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
                    : t('pr_usajili_cancel_after_pd')}. {t('pr_usajili_cancel_renew')}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowCancel(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition"
              >
                <i className="ti ti-chevron-right text-xs" style={{ transform: showCancel ? 'rotate(90deg)' : undefined }} aria-hidden="true" />
                {t('pr_usajili_cancel_sub')}
              </button>

              {showCancel && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
                  <p className="text-sm text-red-700 font-medium">{t('pr_usajili_sure_cancel')}</p>
                  <p className="text-xs text-red-600">
                    {sub.status === 'trial'
                      ? t('pr_usajili_cancel_confirm')
                      : `${t('pr_usajili_cancel_scheduled_chip')} ${sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long' }) : t('pr_usajili_cancel_after_pd')}`}
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={2}
                    placeholder={t('pr_usajili_cancel_reason_ph')}
                    className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  {cancelErr && <p className="text-xs text-red-600">{cancelErr}</p>}
                  {cancelMsg && <p className="text-xs text-green-600">{cancelMsg}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!orgId) return
                        setCancelling(true); setCancelErr(null); setCancelMsg(null)
                        const res  = await fetch(`/api/v1/organizations/${orgId}/subscription/cancel`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
                        })
                        const data = await res.json()
                        if (!res.ok) { setCancelErr(data.error ?? t('pr_err_generic')); setCancelling(false); return }
                        setSub(data.subscription)
                        setCancelMsg(data.message)
                        setShowCancel(false)
                        setCancelling(false)
                      }}
                      disabled={cancelling}
                      className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition"
                    >
                      {cancelling ? t('pr_usajili_cancelling') : t('pr_usajili_confirm_cancel')}
                    </button>
                    <button onClick={() => setShowCancel(false)}
                      className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                      {t('pr_usajili_go_back')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
