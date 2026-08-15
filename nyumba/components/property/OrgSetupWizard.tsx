'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { REGION_NAMES as REGIONS } from '@/lib/data/tanzania-locations'
import { useLanguage } from '@/lib/i18n/context'

type Step = 1 | 2 | 3

export default function OrgSetupWizard() {
  const router = useRouter()
  const { t } = useLanguage()
  const [step,    setStep]    = useState<Step>(1)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [orgType,  setOrgType]  = useState<string>('')
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')
  const [region,   setRegion]   = useState('')
  const [desc,     setDesc]     = useState('')

  const ORG_TYPES = [
    {
      value: 'landlord',
      icon: 'home',
      title: t('pr_setup_type_landlord_title'),
      desc: t('pr_setup_type_landlord_desc'),
    },
    {
      value: 'property_manager',
      icon: 'briefcase',
      title: t('pr_setup_type_manager_title'),
      desc: t('pr_setup_type_manager_desc'),
    },
    {
      value: 'firm',
      icon: 'building-skyscraper',
      title: t('pr_setup_type_firm_title'),
      desc: t('pr_setup_type_firm_desc'),
    },
  ]

  const namePlaceholder =
    orgType === 'landlord' ? t('pr_setup_name_ph_landlord') :
    orgType === 'firm'     ? t('pr_setup_name_ph_firm') :
                             t('pr_setup_name_ph_manager')

  async function handleSubmit() {
    if (!name.trim()) { setError(t('pr_setup_err_name')); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/v1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), org_type: orgType, description: desc.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined, region: region || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('pr_err_generic')); return }
      setStep(3)
      setTimeout(() => router.push('/property/dashboard'), 1500)
    } catch {
      setError(t('pr_setup_err_network'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex flex-col items-center justify-center px-4 py-10">
      {/* Progress */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                s < step ? 'bg-primary-500 text-white' : s === step ? 'bg-primary-500 text-white ring-4 ring-primary-100' : 'bg-gray-200 text-gray-400'
              }`}>
                {s < step ? <i className="ti ti-check text-sm" /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 rounded ${s < step ? 'bg-primary-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
          <span>{t('pr_setup_step_type')}</span>
          <span>{t('pr_setup_step_details')}</span>
          <span>{t('pr_setup_step_done')}</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        {/* Step 1: org type */}
        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{t('pr_setup_welcome_heading')}</h1>
            <p className="text-sm text-gray-500 mb-6">{t('pr_setup_welcome_sub')}</p>
            <div className="space-y-3">
              {ORG_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setOrgType(type.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    orgType === type.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      orgType === type.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <i className={`ti ti-${type.icon} text-lg`} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{type.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                    </div>
                    {orgType === type.value && (
                      <i className="ti ti-circle-check text-primary-500 text-xl ml-auto flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { if (orgType) setStep(2) }}
              disabled={!orgType}
              className="w-full mt-6 bg-primary-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40"
            >
              {t('pr_setup_next')}
            </button>
          </div>
        )}

        {/* Step 2: details */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
              <i className="ti ti-arrow-left" /> {t('pr_setup_back')}
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('pr_setup_details_heading')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('pr_setup_details_sub')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pr_setup_name_label')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={namePlaceholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_setup_phone_label')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+255 7XX XXX XXX"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_setup_email_label')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shirika@email.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_setup_region_label')}</label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">{t('pr_setup_region_ph')}</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_setup_desc_label')}</label>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder={t('pr_setup_desc_ph')}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving || !name.trim()}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40"
              >
                {saving ? t('pr_setup_creating') : t('pr_setup_create_btn')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: success */}
        {step === 3 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-check text-primary-500 text-3xl" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('pr_setup_success_title')}</h2>
            <p className="text-sm text-gray-500">{t('pr_setup_success_sub')}</p>
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center max-w-sm">
        {t('pr_setup_terms_note')}{' '}
        <a href="/terms" className="text-primary-600 underline">{t('pr_setup_terms_label')}</a>{' '}
        na{' '}
        <a href="/privacy" className="text-primary-600 underline">{t('pr_setup_privacy_label')}</a>{' '}
        ya NyumbaFasta.
      </p>
    </div>
  )
}
