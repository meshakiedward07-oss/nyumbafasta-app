'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'

type KycStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info'

interface Banking {
  bank_name: string; account_name: string; account_number: string
  branch: string | null; mobile_money_number: string | null
  mobile_money_provider: string | null; additional_instructions: string | null
}

function BankingSection({ orgId }: { orgId: string }) {
  const { t } = useLanguage()
  const [banking,  setBanking]  = useState<Banking | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const [form, setForm] = useState<Banking>({
    bank_name: '', account_name: '', account_number: '',
    branch: '', mobile_money_number: '', mobile_money_provider: '', additional_instructions: '',
  })

  useEffect(() => {
    fetch(`/api/v1/organizations/${orgId}/banking`)
      .then(r => r.json())
      .then(d => {
        if (d.banking) {
          setBanking(d.banking)
          setForm({ ...d.banking, branch: d.banking.branch ?? '', mobile_money_number: d.banking.mobile_money_number ?? '', mobile_money_provider: d.banking.mobile_money_provider ?? '', additional_instructions: d.banking.additional_instructions ?? '' })
        } else {
          setEditing(true)
        }
      })
      .catch(() => {})
  }, [orgId])

  async function save() {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      setError(t('pr_kyc_bank_req_fields')); return
    }
    setSaving(true); setError(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/banking`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? t('pr_err_generic')); setSaving(false); return }
    setBanking(data.banking); setEditing(false); setSuccess(true)
    setSaving(false); setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ti ti-building-bank text-primary-500 text-lg" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">{t('pr_kyc_bank_title')}</h2>
            <p className="text-xs text-gray-400">{t('pr_kyc_bank_desc')}</p>
          </div>
        </div>
        {banking && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-primary-600 hover:underline">{t('pr_kyc_bank_edit')}</button>
        )}
      </div>

      <div className="p-4">
        {!editing && banking ? (
          <div className="space-y-2">
            {[
              { label: t('pr_kyc_bank_label'),       value: banking.bank_name },
              { label: t('pr_kyc_bank_acct_name'),   value: banking.account_name },
              { label: t('pr_kyc_bank_acct_number'), value: banking.account_number },
              { label: t('pr_kyc_bank_branch_label'),value: banking.branch },
              { label: t('pr_kyc_mobile_money_label'),value: banking.mobile_money_number ? `${banking.mobile_money_number} (${banking.mobile_money_provider ?? ''})` : null },
              { label: t('pr_kyc_bank_extra_label'), value: banking.additional_instructions },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex gap-2 text-sm">
                <span className="text-gray-400 w-32 flex-shrink-0">{r.label}</span>
                <span className="font-medium text-gray-900">{r.value}</span>
              </div>
            ))}
            {success && <p className="text-xs text-green-600 mt-2"><i className="ti ti-check" /> {t('pr_kyc_bank_saved')}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { key: 'bank_name',     label: t('pr_kyc_bank_name_req'),      ph: 'mfano: CRDB Bank, NMB Bank' },
              { key: 'account_name',  label: t('pr_kyc_bank_acct_name_req'), ph: 'Jina kama linavyoonekana benki' },
              { key: 'account_number',label: t('pr_kyc_bank_acct_num_req'),  ph: 'mfano: 0150123456789' },
              { key: 'branch',        label: t('pr_kyc_bank_branch_opt'),    ph: 'mfano: Kariakoo Branch' },
              { key: 'mobile_money_number', label: t('pr_kyc_bank_mobile_opt'),   ph: 'mfano: 0755123456' },
              { key: 'mobile_money_provider', label: t('pr_kyc_bank_provider_opt'), ph: 'mpesa / airtel / tigo / halopesa' },
              { key: 'additional_instructions', label: t('pr_kyc_bank_extra_opt'), ph: 'mfano: Tuma kisha tuma picha ya receipt' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                <input
                  value={(form as unknown as Record<string, string>)[f.key] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            ))}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                {saving ? t('pr_kyc_bank_saving') : t('pr_kyc_bank_save')}
              </button>
              {banking && (
                <button onClick={() => { setEditing(false); setError(null) }}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  {t('pr_kyc_bank_cancel')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
}

// STATUS_INFO is built inside the component to support i18n

export default function KycSubmitPage() {
  const { t } = useLanguage()
  const router = useRouter()

  const STATUS_INFO: Record<KycStatus, { label: string; color: string; icon: string; desc: string }> = {
    pending:        { label: t('pr_kyc_status_pending'),   color: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'clock',        desc: t('pr_kyc_status_banner_pending') },
    approved:       { label: t('pr_kyc_status_approved'),  color: 'bg-green-50 border-green-200 text-green-700', icon: 'circle-check', desc: t('pr_kyc_status_banner_approved') },
    rejected:       { label: t('pr_kyc_status_rejected'),  color: 'bg-red-50   border-red-200   text-red-700',   icon: 'circle-x',     desc: t('pr_kyc_status_banner_rejected') },
    needs_more_info:{ label: t('pr_kyc_status_more_info'), color: 'bg-blue-50  border-blue-200  text-blue-700',  icon: 'info-circle',  desc: t('pr_kyc_status_banner_more') },
  }

  const [submission,  setSubmission]  = useState<Submission | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)
  const [orgId,       setOrgId]       = useState<string | null>(null)
  const [form, setForm] = useState({
    id_document_url:  '',
    title_deed_url:   '',
    tax_cert_url:     '',
    notes:            '',
  })

  useEffect(() => {
    fetch('/api/v1/organizations')
      .then(r => r.json())
      .then(d => {
        const orgs = d.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (primary) setOrgId(primary.organization.id)
      })
      .catch(() => {})

    fetch('/api/v1/kyc')
      .then(r => r.json())
      .then(d => {
        setSubmission(d.submission)
        if (d.submission) {
          setForm({
            id_document_url:  d.submission.id_document_url  ?? '',
            title_deed_url:   d.submission.title_deed_url   ?? '',
            tax_cert_url:     d.submission.tax_cert_url     ?? '',
            notes:            d.submission.notes            ?? '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.id_document_url.trim()) { setError(t('pr_kyc_err_id')); return }
    setSubmitting(true); setError(null)
    try {
      const res  = await fetch('/api/v1/kyc', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('pr_err_generic')); return }
      setSuccess(true)
      setTimeout(() => router.push('/property/dashboard'), 2000)
    } catch { setError(t('pr_err_network')) }
    finally  { setSubmitting(false) }
  }

  if (loading) {
    return <div className="p-6 max-w-2xl mx-auto space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
    </div>
  }

  const statusInfo = submission ? STATUS_INFO[submission.status] : null
  const canSubmit  = !submission || submission.status === 'needs_more_info' || submission.status === 'rejected'

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition">
          <i className="ti ti-arrow-left text-lg" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('pr_kyc_title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('pr_kyc_subtitle')}</p>
        </div>
      </div>

      {/* Current status banner */}
      {statusInfo && submission && (
        <div className={`rounded-2xl border p-4 mb-6 ${statusInfo.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <i className={`ti ti-${statusInfo.icon} text-lg`} aria-hidden="true" />
            <span className="font-semibold text-sm">{statusInfo.label}</span>
          </div>
          <p className="text-xs opacity-80">{statusInfo.desc}</p>
          {submission.rejection_reason && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <p className="text-xs font-semibold">{t('pr_kyc_rejection_label')}</p>
              <p className="text-xs mt-0.5">{submission.rejection_reason}</p>
            </div>
          )}
          {submission.notes && submission.status === 'needs_more_info' && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <p className="text-xs font-semibold">{t('pr_kyc_admin_notes')}</p>
              <p className="text-xs mt-0.5">{submission.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Approved — no form needed */}
      {submission?.status === 'approved' ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-rosette-discount-check text-4xl text-green-500" aria-hidden="true" />
          </div>
          <p className="font-semibold text-gray-900">{t('pr_kyc_approved_title')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('pr_kyc_approved_desc')}</p>
          <button onClick={() => router.push('/property/dashboard')}
            className="mt-4 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
            {t('pr_kyc_back_dash')}
          </button>
        </div>
      ) : (
        <>
          {/* What we need */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-600 mb-3">{t('pr_kyc_needs_intro')}</p>
            <div className="space-y-2">
              {[
                { icon: 'id',               label: t('pr_kyc_doc_id'),   required: true  },
                { icon: 'file-certificate', label: t('pr_kyc_doc_deed'), required: false },
                { icon: 'receipt',          label: t('pr_kyc_doc_tra'),  required: false },
              ].map(d => (
                <div key={d.icon} className="flex items-center gap-2 text-xs">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${d.required ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'}`}>
                    <i className={`ti ti-${d.icon} text-xs`} aria-hidden="true" />
                  </div>
                  <span className="text-gray-600">{d.label}</span>
                  {d.required && <span className="text-red-500 text-[10px] font-bold">{t('pr_kyc_required_badge')}</span>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">{t('pr_kyc_hint')}</p>
          </div>

          {/* Success */}
          {success ? (
            <div className="text-center py-8">
              <i className="ti ti-circle-check text-5xl text-green-500" aria-hidden="true" />
              <p className="font-semibold text-gray-900 mt-2">{t('pr_kyc_sent_short')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('pr_kyc_redirecting')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  {t('pr_kyc_id_link_label')} <span className="text-red-500">*</span>
                </label>
                <input type="url" value={form.id_document_url}
                  onChange={e => setForm(p => ({ ...p, id_document_url: e.target.value }))}
                  placeholder="https://drive.google.com/... au https://res.cloudinary.com/..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('pr_kyc_deed_link_label')}</label>
                <input type="url" value={form.title_deed_url}
                  onChange={e => setForm(p => ({ ...p, title_deed_url: e.target.value }))}
                  placeholder="https://... (hiari)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('pr_kyc_tax_link_label')}</label>
                <input type="url" value={form.tax_cert_url}
                  onChange={e => setForm(p => ({ ...p, tax_cert_url: e.target.value }))}
                  placeholder="https://... (hiari)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">{t('pr_kyc_notes_label')}</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={t('pr_kyc_notes_ph')}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button type="submit" disabled={submitting || !canSubmit}
                className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                {submitting ? t('pr_kyc_waiting') : submission?.status === 'needs_more_info' ? t('pr_kyc_submit_more') : t('pr_kyc_submit_btn')}
              </button>

              {!canSubmit && (
                <p className="text-xs text-gray-400 text-center">{t('pr_kyc_awaiting_review')}</p>
              )}
            </form>
          )}
        </>
      )}

      {/* Banking details — always available to org owners regardless of KYC status */}
      {orgId && <BankingSection orgId={orgId} />}
    </div>
  )
}
