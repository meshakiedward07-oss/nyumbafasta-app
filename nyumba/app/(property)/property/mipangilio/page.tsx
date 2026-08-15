'use client'
import { useEffect, useState } from 'react'
import { TANZANIA_REGIONS } from '@/lib/data/tanzania-locations'
import type { Organization, OrgType } from '@/lib/types/property'
import { useLanguage } from '@/lib/i18n/context'

type Tab = 'profile' | 'billing' | 'reminders' | 'danger'

type ReminderSettings = {
  remindDaysBefore: number
  remindDaysOverdue: number
  enableWhatsApp: boolean
}

const DEFAULT_REMINDERS: ReminderSettings = { remindDaysBefore: 3, remindDaysOverdue: 1, enableWhatsApp: true }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

export default function MipangilioPage() {
  const { t } = useLanguage()

  const ORG_TYPE_OPTIONS: { value: OrgType; label: string; desc: string }[] = [
    { value: 'landlord',         label: t('pr_settings_org_type_landlord'), desc: t('pr_settings_type_landlord_desc') },
    { value: 'property_manager', label: t('pr_settings_org_type_manager'),  desc: t('pr_settings_type_manager_desc')  },
    { value: 'firm',             label: t('pr_settings_org_type_firm'),     desc: t('pr_settings_type_firm_desc')     },
  ]

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile',   label: t('pr_settings_tab_profile_label'), icon: 'building'       },
    { id: 'billing',   label: t('pr_settings_tab_billing_label'),  icon: 'receipt'        },
    { id: 'reminders', label: t('pr_settings_tab_reminders_label'),icon: 'bell'           },
    { id: 'danger',    label: t('pr_settings_tab_danger_label'),   icon: 'alert-triangle' },
  ]

  const [org,     setOrg]     = useState<Organization | null>(null)
  const [orgId,   setOrgId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('profile')

  // Profile form
  const [name,     setName]     = useState('')
  const [orgType,  setOrgType]  = useState<OrgType>('landlord')
  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')
  const [region,   setRegion]   = useState('')
  const [district, setDistrict] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)

  // Billing form
  const [billingName,    setBillingName]    = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingPhone,   setBillingPhone]   = useState('')
  const [billingEmail,   setBillingEmail]   = useState('')
  const [taxId,          setTaxId]          = useState('')
  const [billSaving,     setBillSaving]     = useState(false)
  const [billSaved,      setBillSaved]      = useState(false)
  const [billErr,        setBillErr]        = useState<string | null>(null)

  // Reminders
  const [reminders,        setReminders]        = useState<ReminderSettings>(DEFAULT_REMINDERS)
  const [reminderSaved,    setReminderSaved]    = useState(false)
  const [reminderSaving,   setReminderSaving]   = useState(false)
  const [reminderErr,      setReminderErr]      = useState<string | null>(null)

  // Danger zone
  const [reason,     setReason]     = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [deactErr,   setDeactErr]   = useState<string | null>(null)

  const districts = region ? (TANZANIA_REGIONS.find(r => r.name === region)?.districts ?? []) : []

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/v1/organizations')
        const data = await res.json()
        if (!data.organizations?.length) return
        const primary = data.organizations.find((o: { role: string }) => o.role === 'owner') ?? data.organizations[0]
        const id = primary.organization.id as string
        setOrgId(id)
        const oRes  = await fetch(`/api/v1/organizations/${id}`)
        const oData = await oRes.json()
        const o: Organization = oData.organization
        setOrg(o)
        setName(o.name ?? '')
        setOrgType(o.org_type ?? 'landlord')
        setPhone(o.phone ?? '')
        setEmail(o.email ?? '')
        setRegion(o.region ?? '')
        setDistrict(o.district ?? '')
        setBillingName(o.billing_name ?? '')
        setBillingAddress(o.billing_address ?? '')
        setBillingPhone(o.billing_phone ?? '')
        setBillingEmail(o.billing_email ?? '')
        setTaxId(o.tax_id ?? '')
        // Load reminder settings from org (with fallback to defaults)
        const raw = o as unknown as Record<string, unknown>
        setReminders({
          remindDaysBefore:  typeof raw.remind_days_before  === 'number' ? raw.remind_days_before  : DEFAULT_REMINDERS.remindDaysBefore,
          remindDaysOverdue: typeof raw.remind_days_overdue === 'number' ? raw.remind_days_overdue : DEFAULT_REMINDERS.remindDaysOverdue,
          enableWhatsApp:    typeof raw.enable_whatsapp_reminders === 'boolean' ? raw.enable_whatsapp_reminders : DEFAULT_REMINDERS.enableWhatsApp,
        })
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function saveProfile() {
    if (!orgId || !name.trim()) return
    setSaving(true); setSaveErr(null); setSaved(false)
    const res  = await fetch(`/api/v1/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), org_type: orgType, phone: phone.trim() || null, email: email.trim() || null, region: region || null, district: district || null }),
    })
    const data = await res.json()
    if (!res.ok) { setSaveErr(data.error ?? t('pr_err_generic')); setSaving(false); return }
    setOrg(data.organization)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  async function saveBilling() {
    if (!orgId) return
    setBillSaving(true); setBillErr(null); setBillSaved(false)
    const res  = await fetch(`/api/v1/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billing_name:    billingName.trim()    || null,
        billing_address: billingAddress.trim() || null,
        billing_phone:   billingPhone.trim()   || null,
        billing_email:   billingEmail.trim()   || null,
        tax_id:          taxId.trim()          || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setBillErr(data.error ?? t('pr_err_generic')); setBillSaving(false); return }
    setOrg(data.organization)
    setBillSaved(true)
    setTimeout(() => setBillSaved(false), 3000)
    setBillSaving(false)
  }

  async function deactivate() {
    if (!orgId) return
    if (!confirm(t('pr_settings_confirm_close'))) return
    setDeactivating(true); setDeactErr(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setDeactErr(data.error ?? t('pr_err_generic')); setDeactivating(false); return }
    window.location.href = '/property/dashboard'
  }

  async function saveReminders() {
    if (!orgId) return
    setReminderSaving(true); setReminderErr(null)
    const res = await fetch(`/api/v1/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        remind_days_before:        reminders.remindDaysBefore,
        remind_days_overdue:       reminders.remindDaysOverdue,
        enable_whatsapp_reminders: reminders.enableWhatsApp,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setReminderErr(data.error ?? t('pr_err_generic')); setReminderSaving(false); return }
    setOrg(data.organization)
    setReminderSaved(true)
    setTimeout(() => setReminderSaved(false), 3000)
    setReminderSaving(false)
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (!org) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">{t('pr_settings_no_org')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('pr_settings_no_org_desc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('pr_settings_org_title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{org.name}</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 overflow-x-auto">
        {TABS.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition flex-1 justify-center ${
              tab === tabItem.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            } ${tabItem.id === 'danger' && tab !== 'danger' ? 'hover:text-red-500' : ''}`}
          >
            <i className={`ti ti-${tabItem.icon} text-base ${tabItem.id === 'danger' ? 'text-red-400' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{tabItem.label}</span>
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">{t('pr_settings_profile_tab_h')}</h2>
          <div className="space-y-4">
            <Field label={t('pr_settings_org_name')}>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder={t('pr_settings_org_name_ph')} />
            </Field>

            <Field label={t('pr_settings_org_type')}>
              <select value={orgType} onChange={e => setOrgType(e.target.value as OrgType)} className={`${inputCls} bg-white`}>
                {ORG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{ORG_TYPE_OPTIONS.find(o => o.value === orgType)?.desc}</p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('pr_settings_phone')}>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+255 7XX XXX XXX" type="tel" />
              </Field>
              <Field label={t('pr_settings_email')}>
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="barua@shirika.com" type="email" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('pr_settings_region')}>
                <select
                  value={region}
                  onChange={e => { setRegion(e.target.value); setDistrict('') }}
                  className={`${inputCls} bg-white`}
                >
                  <option value="">{t('pr_settings_region_opt')}</option>
                  {TANZANIA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label={t('pr_settings_district')}>
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  disabled={!region}
                  className={`${inputCls} bg-white disabled:opacity-50`}
                >
                  <option value="">{t('pr_settings_district_opt')}</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>

            {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}

            <button
              onClick={saveProfile}
              disabled={saving || !name.trim()}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> {t('pr_settings_saving_state')}</>
              ) : saved ? (
                <><i className="ti ti-check" aria-hidden="true" /> {t('pr_settings_saved_state')}</>
              ) : t('pr_settings_save')}
            </button>
          </div>
        </div>
      )}

      {/* Billing tab */}
      {tab === 'billing' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">{t('pr_settings_billing_tab_h')}</h2>
          <p className="text-sm text-gray-400 mb-4">{t('pr_settings_billing_desc')}</p>
          <div className="space-y-4">
            <Field label={t('pr_settings_billing_name')}>
              <input value={billingName} onChange={e => setBillingName(e.target.value)} className={inputCls} placeholder={t('pr_settings_billing_name_ph')} />
            </Field>

            <Field label={t('pr_settings_billing_address')}>
              <textarea
                value={billingAddress}
                onChange={e => setBillingAddress(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder={t('pr_settings_billing_addr_ph')}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('pr_settings_billing_phone')}>
                <input value={billingPhone} onChange={e => setBillingPhone(e.target.value)} className={inputCls} placeholder="+255 7XX XXX XXX" type="tel" />
              </Field>
              <Field label={t('pr_settings_billing_email')}>
                <input value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className={inputCls} placeholder="malipo@shirika.com" type="email" />
              </Field>
            </div>

            <Field label={t('pr_settings_tax_id')}>
              <input value={taxId} onChange={e => setTaxId(e.target.value)} className={inputCls} placeholder={t('pr_settings_tin_ph')} />
            </Field>

            {billErr && <p className="text-sm text-red-600">{billErr}</p>}

            <button
              onClick={saveBilling}
              disabled={billSaving}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {billSaving ? (
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> {t('pr_settings_saving_state')}</>
              ) : billSaved ? (
                <><i className="ti ti-check" aria-hidden="true" /> {t('pr_settings_saved_state')}</>
              ) : t('pr_settings_billing_save')}
            </button>
          </div>
        </div>
      )}

      {/* Reminders tab */}
      {tab === 'reminders' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">{t('pr_settings_reminder_heading')}</h2>
            <p className="text-sm text-gray-400">{t('pr_settings_reminder_desc')}</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div>
              <p className="text-sm font-medium text-gray-900">{t('pr_settings_whatsapp_toggle')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('pr_settings_whatsapp_desc')}</p>
            </div>
            <button
              onClick={() => setReminders(r => ({ ...r, enableWhatsApp: !r.enableWhatsApp }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${reminders.enableWhatsApp ? 'bg-primary-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${reminders.enableWhatsApp ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <Field label={t('pr_settings_remind_before_label')}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={30}
                value={reminders.remindDaysBefore}
                onChange={e => setReminders(r => ({ ...r, remindDaysBefore: Number(e.target.value) }))}
                className={`${inputCls} w-24`}
              />
              <span className="text-sm text-gray-500">{t('pr_settings_days_before_due')}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('pr_settings_same_day')}</p>
          </Field>

          <Field label={t('pr_settings_remind_overdue_label')}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={reminders.remindDaysOverdue}
                onChange={e => setReminders(r => ({ ...r, remindDaysOverdue: Number(e.target.value) }))}
                className={`${inputCls} w-24`}
              />
              <span className="text-sm text-gray-500">{t('pr_settings_days_after_due')}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('pr_settings_overdue_hint2')}</p>
          </Field>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">{t('pr_settings_summary_label')}</p>
            <p>• {t('pr_settings_remind_day_count')} {reminders.remindDaysBefore} {t('pr_settings_before_payment')}</p>
            <p>• {t('pr_settings_warn_after')} {reminders.remindDaysOverdue} {t('pr_settings_after_late')}</p>
            <p>• WhatsApp: {reminders.enableWhatsApp ? t('pr_settings_whatsapp_on') : t('pr_settings_whatsapp_off')}</p>
          </div>

          {reminderErr && <p className="text-sm text-red-600">{reminderErr}</p>}
          <button
            onClick={saveReminders}
            disabled={reminderSaving}
            className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {reminderSaving ? (
              <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> {t('pr_settings_saving_state')}</>
            ) : reminderSaved ? (
              <><i className="ti ti-check" aria-hidden="true" /> {t('pr_settings_saved_state')}</>
            ) : t('pr_settings_reminder_save')}
          </button>
        </div>
      )}

      {/* Danger zone */}
      {tab === 'danger' && (
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className="ti ti-alert-triangle text-red-500 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-red-700">{t('pr_settings_danger_zone')}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">{t('pr_settings_danger_caution')}</p>

          <div className="border border-red-100 rounded-2xl p-4 bg-red-50/50">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">{t('pr_settings_close_org_title')}</h3>
            <p className="text-xs text-gray-500 mb-3">{t('pr_settings_close_org_body')}</p>
            <Field label={t('pr_settings_close_reason_label')}>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder={t('pr_settings_close_reason_ph2')}
              />
            </Field>
            {deactErr && <p className="text-sm text-red-600 mt-2">{deactErr}</p>}
            <button
              onClick={deactivate}
              disabled={deactivating}
              className="mt-3 w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deactivating ? (
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> {t('pr_settings_closing_btn')}</>
              ) : (
                <><i className="ti ti-lock" aria-hidden="true" /> {t('pr_settings_close_action')}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
