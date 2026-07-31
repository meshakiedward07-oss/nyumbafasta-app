'use client'
import { useEffect, useState } from 'react'
import { TANZANIA_REGIONS } from '@/lib/data/tanzania-locations'
import type { Organization, OrgType } from '@/lib/types/property'

const ORG_TYPE_OPTIONS: { value: OrgType; label: string; desc: string }[] = [
  { value: 'landlord',         label: 'Mmiliki wa Nyumba',   desc: 'Mmiliki mmoja anayesimamia mali yake mwenyewe' },
  { value: 'property_manager', label: 'Msimamizi wa Mali',   desc: 'Timu ndogo inayosimamia mali za wengine' },
  { value: 'firm',             label: 'Kampuni ya Mali',      desc: 'Kampuni rasmi ya usimamizi wa mali' },
]

type Tab = 'profile' | 'billing' | 'reminders' | 'danger'

type ReminderSettings = {
  remindDaysBefore: number
  remindDaysOverdue: number
  enableWhatsApp: boolean
}

const LS_REMINDERS_KEY = 'nf_reminder_settings'
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
  const [reminders,      setReminders]      = useState<ReminderSettings>(DEFAULT_REMINDERS)
  const [reminderSaved,  setReminderSaved]  = useState(false)

  // Danger zone
  const [reason,     setReason]     = useState('')
  const [deactivating, setDeactivating] = useState(false)
  const [deactErr,   setDeactErr]   = useState<string | null>(null)

  const districts = region ? (TANZANIA_REGIONS.find(r => r.name === region)?.districts ?? []) : []

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_REMINDERS_KEY)
      if (stored) setReminders(JSON.parse(stored))
    } catch { /* silent */ }

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
    if (!res.ok) { setSaveErr(data.error ?? 'Kuna tatizo'); setSaving(false); return }
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
    if (!res.ok) { setBillErr(data.error ?? 'Kuna tatizo'); setBillSaving(false); return }
    setOrg(data.organization)
    setBillSaved(true)
    setTimeout(() => setBillSaved(false), 3000)
    setBillSaving(false)
  }

  async function deactivate() {
    if (!orgId) return
    if (!confirm('Una uhakika? Shirika litafungwa. Data yako iko salama na unaweza kuwasiliana nasi kulifungua tena.')) return
    setDeactivating(true); setDeactErr(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setDeactErr(data.error ?? 'Kuna tatizo'); setDeactivating(false); return }
    window.location.href = '/property/dashboard'
  }

  function saveReminders() {
    localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(reminders))
    setReminderSaved(true)
    setTimeout(() => setReminderSaved(false), 3000)
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile',   label: 'Taarifa za Shirika', icon: 'building'       },
    { id: 'billing',   label: 'Maelezo ya Malipo',  icon: 'receipt'        },
    { id: 'reminders', label: 'Vikumbusho',          icon: 'bell'           },
    { id: 'danger',    label: 'Hatua za Hatari',     icon: 'alert-triangle' },
  ]

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
          <p className="text-gray-500 font-medium mt-3">Huna shirika bado</p>
          <p className="text-sm text-gray-400 mt-1">Unda shirika kwanza ili uweze kubadilisha mipangilio.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mipangilio ya Shirika</h1>
        <p className="text-sm text-gray-500 mt-0.5">{org.name}</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition flex-1 justify-center ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            } ${t.id === 'danger' && tab !== 'danger' ? 'hover:text-red-500' : ''}`}
          >
            <i className={`ti ti-${t.icon} text-base ${t.id === 'danger' ? 'text-red-400' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Taarifa za Shirika</h2>
          <div className="space-y-4">
            <Field label="Jina la Shirika *">
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Jina la shirika lako" />
            </Field>

            <Field label="Aina ya Shirika">
              <select value={orgType} onChange={e => setOrgType(e.target.value as OrgType)} className={`${inputCls} bg-white`}>
                {ORG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{ORG_TYPE_OPTIONS.find(o => o.value === orgType)?.desc}</p>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Simu">
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+255 7XX XXX XXX" type="tel" />
              </Field>
              <Field label="Barua Pepe">
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="barua@shirika.com" type="email" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Mkoa">
                <select
                  value={region}
                  onChange={e => { setRegion(e.target.value); setDistrict('') }}
                  className={`${inputCls} bg-white`}
                >
                  <option value="">Chagua mkoa</option>
                  {TANZANIA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Wilaya">
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  disabled={!region}
                  className={`${inputCls} bg-white disabled:opacity-50`}
                >
                  <option value="">Chagua wilaya</option>
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
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inaokolewa...</>
              ) : saved ? (
                <><i className="ti ti-check" aria-hidden="true" /> Imeokolewa!</>
              ) : 'Hifadhi Mabadiliko'}
            </button>
          </div>
        </div>
      )}

      {/* Billing tab */}
      {tab === 'billing' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">Maelezo ya Malipo</h2>
          <p className="text-sm text-gray-400 mb-4">Taarifa hizi zitatumika kwenye ankara za malipo ya usajili.</p>
          <div className="space-y-4">
            <Field label="Jina la Malipo">
              <input value={billingName} onChange={e => setBillingName(e.target.value)} className={inputCls} placeholder="Jina kamili au la kampuni" />
            </Field>

            <Field label="Anwani">
              <textarea
                value={billingAddress}
                onChange={e => setBillingAddress(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Anwani ya kufikia (mtaa, mji)"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Simu ya Malipo">
                <input value={billingPhone} onChange={e => setBillingPhone(e.target.value)} className={inputCls} placeholder="+255 7XX XXX XXX" type="tel" />
              </Field>
              <Field label="Barua Pepe ya Malipo">
                <input value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className={inputCls} placeholder="malipo@shirika.com" type="email" />
              </Field>
            </div>

            <Field label="Nambari ya Kodi (TIN/VAT)">
              <input value={taxId} onChange={e => setTaxId(e.target.value)} className={inputCls} placeholder="000-000-000" />
            </Field>

            {billErr && <p className="text-sm text-red-600">{billErr}</p>}

            <button
              onClick={saveBilling}
              disabled={billSaving}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {billSaving ? (
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inaokolewa...</>
              ) : billSaved ? (
                <><i className="ti ti-check" aria-hidden="true" /> Imeokolewa!</>
              ) : 'Hifadhi Taarifa za Malipo'}
            </button>
          </div>
        </div>
      )}

      {/* Reminders tab */}
      {tab === 'reminders' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Mipangilio ya Vikumbusho</h2>
            <p className="text-sm text-gray-400">Vikumbusho vya WhatsApp vitumwe kiotomatiki kwa wapangaji.</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Vikumbusho vya WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">Tuma arifa kwa wapangaji kupitia WhatsApp</p>
            </div>
            <button
              onClick={() => setReminders(r => ({ ...r, enableWhatsApp: !r.enableWhatsApp }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${reminders.enableWhatsApp ? 'bg-primary-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${reminders.enableWhatsApp ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <Field label="Tuma Kikumbusho Kabla ya Siku Ngapi za Kulipa Kodi">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={30}
                value={reminders.remindDaysBefore}
                onChange={e => setReminders(r => ({ ...r, remindDaysBefore: Number(e.target.value) }))}
                className={`${inputCls} w-24`}
              />
              <span className="text-sm text-gray-500">siku kabla ya tarehe ya kulipa</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">0 = siku hiyo hiyo ya kulipa. Kikumbusho kitumwe saa 9 asubuhi.</p>
          </Field>

          <Field label="Tuma Onyo Baada ya Siku Ngapi za Kuchelewa">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={reminders.remindDaysOverdue}
                onChange={e => setReminders(r => ({ ...r, remindDaysOverdue: Number(e.target.value) }))}
                className={`${inputCls} w-24`}
              />
              <span className="text-sm text-gray-500">siku baada ya kuchelewa</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Onyo litumwe kwa wapangaji ambao hawajalipa baada ya siku hizi.</p>
          </Field>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">Muhtasari wa Mipangilio ya Sasa:</p>
            <p>• Kikumbusho siku {reminders.remindDaysBefore} kabla ya tarehe ya malipo</p>
            <p>• Onyo siku {reminders.remindDaysOverdue} baada ya kuchelewa</p>
            <p>• WhatsApp: {reminders.enableWhatsApp ? 'Imewezeshwa ✓' : 'Imezimwa ✗'}</p>
          </div>

          <button
            onClick={saveReminders}
            className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition flex items-center justify-center gap-2"
          >
            {reminderSaved
              ? <><i className="ti ti-check" aria-hidden="true" /> Imeokolewa!</>
              : 'Hifadhi Mipangilio ya Vikumbusho'
            }
          </button>
        </div>
      )}

      {/* Danger zone */}
      {tab === 'danger' && (
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className="ti ti-alert-triangle text-red-500 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-red-700">Eneo la Hatari</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Vitendo hapa ni vya kudumu au vinavyohitaji tahadhari kubwa.</p>

          <div className="border border-red-100 rounded-2xl p-4 bg-red-50/50">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Funga Shirika</h3>
            <p className="text-xs text-gray-500 mb-3">
              Shirika litafungwa na usajili utasimamishwa. Data yako — mali, wapangaji, mikataba — iko salama.
              Wasiliana nasi ili ufungue tena wakati wowote.
            </p>
            <Field label="Sababu (hiari)">
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Eleza kwa nini unafunga shirika (hiari)"
              />
            </Field>
            {deactErr && <p className="text-sm text-red-600 mt-2">{deactErr}</p>}
            <button
              onClick={deactivate}
              disabled={deactivating}
              className="mt-3 w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deactivating ? (
                <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inafunga...</>
              ) : (
                <><i className="ti ti-lock" aria-hidden="true" /> Funga Shirika</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
