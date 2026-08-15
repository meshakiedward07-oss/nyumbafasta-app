'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan')
  const { t } = useLanguage()

  const CATEGORIES: { value: string; label: string }[] = [
    { value: 'Nyumba na Mali',       label: t('adv_cat_nyumba_mali')  },
    { value: 'Hoteli na Lodges',     label: t('adv_cat_hoteli')       },
    { value: 'Biashara ya Chakula',  label: t('adv_cat_chakula')      },
    { value: 'Afya na Dawa',         label: t('adv_cat_afya')         },
    { value: 'Elimu',                label: t('adv_cat_elimu')        },
    { value: 'Usafiri',              label: t('adv_cat_usafiri')      },
    { value: 'Fedha na Bima',        label: t('adv_cat_fedha')        },
    { value: 'Teknolojia',           label: t('adv_cat_teknolojia')   },
    { value: 'Nguo na Mitindo',      label: t('adv_cat_nguo')         },
    { value: 'Sanaa na Burudani',    label: t('adv_cat_sanaa')        },
    { value: 'Kilimo',               label: t('adv_cat_kilimo')       },
    { value: 'Ujenzi na Nyenzo',     label: t('adv_cat_ujenzi')       },
    { value: 'Mengineyo',            label: t('adv_cat_mengineyo')    },
  ]

  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)

  const [form, setForm] = useState({
    business_name: '', business_category: '', contact_phone: '',
    whatsapp_number: '', city: '', district: '', description: '', website_url: '',
    email: '', password: '', confirm_password: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (step === 1) {
      if (!form.business_name || !form.business_category || !form.contact_phone || !form.whatsapp_number || !form.city) {
        setError(t('adv_fill_required')); return
      }
      setStep(2); return
    }
    if (form.password !== form.confirm_password) { setError(t('adv_passwords_mismatch')); return }
    if (form.password.length < 8) { setError(t('adv_password_too_short')); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/advertising/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('common_error')); return }
      router.push(planId ? `/advertising/new?plan=${planId}` : '/advertising/dashboard')
    } catch {
      setError(t('adv_connection_error'))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Branded header */}
      <div className="bg-gradient-to-r from-[#085041] to-primary-600 px-4 py-5 text-center text-white">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" width={28} height={28} className="object-contain" />
          <span className="font-bold text-base">NyumbaFasta</span>
        </div>
        <p className="text-xs text-primary-200">{t('adv_register_subtitle')}</p>
      </div>

      <div className="flex-1 flex items-start justify-center pt-6 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-6">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { n: 1, label: t('adv_step_business') },
              { n: 2, label: t('adv_step_account') },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i > 0 ? 'flex-1' : ''}`}>
                  {i > 0 && (
                    <div className={`h-0.5 flex-1 transition-colors ${step >= s.n ? 'bg-primary-400' : 'bg-gray-200'}`} />
                  )}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    step >= s.n ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s.n ? '✓' : s.n}
                  </div>
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${step >= s.n ? 'text-primary-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <h1 className="text-lg font-bold text-gray-800 mb-4">
            {step === 1 ? t('adv_business_info_title') : t('adv_create_account_title')}
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4 flex items-start gap-2">
              <span className="flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {step === 1 && (
              <>
                <Field label={`${t('adv_business_name')} *`} required>
                  <input
                    required value={form.business_name}
                    onChange={e => set('business_name', e.target.value)}
                    className="input"
                    placeholder={t('adv_biz_name_placeholder')}
                  />
                </Field>

                <Field label={`${t('adv_business_category')} *`} required>
                  <select
                    required value={form.business_category}
                    onChange={e => set('business_category', e.target.value)}
                    className="input"
                  >
                    <option value="">{t('adv_select_category')}</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={`${t('adv_contact_phone')} *`}>
                    <input
                      required type="tel" value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      className="input" placeholder="0712345678"
                    />
                  </Field>
                  <Field label={`${t('adv_whatsapp')} *`}>
                    <input
                      required type="tel" value={form.whatsapp_number}
                      onChange={e => set('whatsapp_number', e.target.value)}
                      className="input" placeholder="255712345678"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">{t('adv_whatsapp_hint')}</p>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={`${t('adv_city_region')} *`}>
                    <input
                      required value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className="input" placeholder="Dar es Salaam"
                    />
                  </Field>
                  <Field label={t('adv_district')}>
                    <input
                      value={form.district}
                      onChange={e => set('district', e.target.value)}
                      className="input" placeholder="Kinondoni"
                    />
                  </Field>
                </div>

                <Field label={t('adv_biz_desc_optional')}>
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                    className="input resize-none"
                    placeholder={t('adv_business_desc_placeholder')}
                  />
                </Field>

                <Field label={t('adv_website_optional')}>
                  <input
                    type="url" value={form.website_url}
                    onChange={e => set('website_url', e.target.value)}
                    className="input" placeholder="https://..."
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-sm text-primary-800 flex items-start gap-2">
                  <span>✅</span>
                  <span>{t('adv_biz_saved')}</span>
                </div>

                <Field label={`${t('adv_email_label')} *`}>
                  <input
                    required type="email" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    className="input" placeholder="biashara@email.com"
                    autoComplete="email"
                  />
                </Field>

                <Field label={`${t('adv_password_label')} *`}>
                  <div className="relative">
                    <input
                      required type={showPw ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)}
                      className="input pr-16" placeholder={t('adv_password_hint')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? t('adv_hide') : t('adv_show')}
                    </button>
                  </div>
                </Field>

                <Field label={`${t('adv_confirm_password')} *`}>
                  <input
                    required type={showPw ? 'text' : 'password'} value={form.confirm_password}
                    onChange={e => set('confirm_password', e.target.value)}
                    className="input" placeholder={t('adv_confirm_password_placeholder')}
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step === 2 && (
                <button
                  type="button" onClick={() => { setStep(1); setError('') }}
                  className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  ← {t('common_back')}
                </button>
              )}
              <button
                type="submit" disabled={loading}
                className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50"
              >
                {loading ? t('adv_registering') : step === 1 ? `${t('common_continue')} →` : t('adv_create_account_btn')}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {t('adv_have_account')}{' '}
            <Link href="/advertising/login" className="text-primary-600 font-semibold hover:underline">
              {t('adv_login_here')}
            </Link>
          </p>
        </div>
      </div>

      <style>{`.input { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px 14px; font-size: 14px; outline: none; } .input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.12); }`}</style>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
