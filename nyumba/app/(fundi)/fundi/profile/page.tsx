'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MAINTENANCE_CATEGORY_LABELS } from '@/lib/types/property'
import type { MaintenanceCategory } from '@/lib/types/property'
import { useLanguage } from '@/lib/i18n/context'

const CATEGORIES = ['plumbing', 'electrical', 'structural', 'cleaning', 'security', 'appliance', 'other'] as const

export default function FundiProfilePage() {
  const { t } = useLanguage()
  const KYC_STATUS: Record<string, { label: string; cls: string; icon: string }> = {
    none:     { label: t('fp_kyc_status_none'),     cls: 'bg-gray-100 text-gray-500',  icon: 'circle'       },
    pending:  { label: t('fp_kyc_status_pending'),  cls: 'bg-amber-50 text-amber-700', icon: 'clock'        },
    approved: { label: t('fp_kyc_status_approved'), cls: 'bg-green-50 text-green-700', icon: 'circle-check' },
    rejected: { label: t('fp_kyc_status_rejected'), cls: 'bg-red-50 text-red-600',     icon: 'circle-x'     },
  }
  const [form, setForm] = useState({
    full_name: '', phone: '', business_name: '', category: 'other',
    specialty: '', location: '', bio: '', experience_years: '', is_available: true,
  })
  const [kycStatus,  setKycStatus]  = useState('none')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/v1/fundi/me')
        const data = await res.json()
        const u = data.user  ?? {}
        const f = data.fundi ?? {}
        setForm({
          full_name:       u.full_name     ?? '',
          phone:           u.phone         ?? '',
          business_name:   f.business_name ?? '',
          category:        f.category      ?? 'other',
          specialty:       f.specialty     ?? '',
          location:        f.location      ?? '',
          bio:             f.bio           ?? '',
          experience_years: f.experience_years ? String(f.experience_years) : '',
          is_available:    f.is_available  ?? true,
        })
        setKycStatus(f.kyc_status ?? 'none')
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false)
    try {
      const res = await fetch('/api/v1/fundi/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:       form.full_name.trim()       || null,
          phone:           form.phone.trim()           || null,
          business_name:   form.business_name.trim()   || null,
          category:        form.category,
          specialty:       form.specialty.trim()       || null,
          location:        form.location.trim()        || null,
          bio:             form.bio.trim()             || null,
          experience_years: form.experience_years ? parseInt(form.experience_years) : null,
          is_available:    form.is_available,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('fp_err_generic')); return }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch { setError(t('fp_profile_save_error')) }
    finally { setSaving(false) }
  }

  const kycInfo = KYC_STATUS[kycStatus] ?? KYC_STATUS.none

  if (loading) {
    return <div className="p-4 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('fp_profile_heading')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('fp_profile_sub')}</p>
      </div>

      {/* KYC status card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className={`ti ti-${kycInfo.icon} text-lg`} aria-hidden="true" />
            <div>
              <p className="text-xs text-gray-500">{t('fp_profile_kyc_status')}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${kycInfo.cls}`}>{kycInfo.label}</span>
            </div>
          </div>
          <Link href="/fundi/kyc"
            className="text-xs px-3 py-1.5 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition">
            {kycStatus === 'none' ? t('fp_profile_submit_kyc') : t('fp_profile_view_kyc')}
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {/* Personal info */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fp_profile_personal_info')}</p>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_full_name')}</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_phone')}</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+255 7XX XXX XXX"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        </div>

        {/* Business info */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">{t('fp_profile_biz_info')}</p>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_biz_name')}</label>
          <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
            placeholder={t('fp_profile_biz_name_ph')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_main_category')}</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c as MaintenanceCategory]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_specialty')}</label>
          <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
            placeholder={t('fp_profile_specialty_ph')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_location')}</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder={t('fp_profile_location_ph')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_experience')}</label>
            <input type="number" min="0" max="50" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">{t('fp_profile_bio')}</label>
          <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder={t('fp_profile_bio_ph')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
        </div>

        {/* Availability toggle */}
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('fp_profile_available')}</p>
            <p className="text-xs text-gray-400">{t('fp_profile_available_sub')}</p>
          </div>
          <button type="button" onClick={() => setForm(f => ({ ...f, is_available: !f.is_available }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_available ? 'bg-primary-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_available ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {error   && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{t('fp_profile_saved')}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
          {saving ? t('fp_profile_saving') : t('fp_profile_save_btn')}
        </button>
      </div>
    </div>
  )
}
