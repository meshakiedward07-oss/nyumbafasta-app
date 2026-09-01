'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { REGION_NAMES, getDistricts, getWards } from '@/lib/data/tanzania-locations'
import UploadCreative from '@/components/ads/UploadCreative'
import { useLanguage } from '@/lib/i18n/context'

type Plan = {
  id: string; name: string; ad_type: string; price_tzs: number
  duration_days: number; slot_limit: number; description: string | null; features: string[]
  geo_scope: 'region' | 'district' | 'ward'
}

function NewCampaignForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  const TYPE_LABELS: Record<string, string> = {
    banner:   t('adv_type_banner'),
    search:   t('adv_type_search'),
    nearby:   t('adv_type_nearby'),
    video:    t('adv_type_video'),
    featured: t('adv_type_featured'),
  }

  const CTA_TYPES = [
    { value: 'whatsapp', label: `💬 ${t('adv_whatsapp')}`,   placeholder: '255712345678' },
    { value: 'call',     label: `📞 ${t('adv_cta_call')}`, placeholder: '255712345678' },
    { value: 'website',  label: `🌐 ${t('adv_cta_website')}`, placeholder: 'https://...' },
  ]

  const [plans, setPlans]         = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [advertiserOk, setAdvertiserOk] = useState<boolean | null>(null)
  const [advertiserWa, setAdvertiserWa] = useState<string>('')
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)

  const [form, setForm] = useState({
    plan_id: searchParams.get('plan') ?? '',
    ad_type: '', title: '', body_text: '',
    image_url: '', video_url: '',
    cta_type: 'whatsapp', cta_value: '',
    target_region: '', target_district: '', target_category: '',
  })
  const [targetWards, setTargetWards] = useState<string[]>([])

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function toggleWard(w: string) {
    setTargetWards(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])
  }

  useEffect(() => {
    fetch('/api/v1/advertising/plans')
      .then(r => r.json())
      .then(d => setPlans(d.plans ?? []))
    fetch('/api/v1/advertising/me')
      .then(async r => {
        if (!r.ok) { setAdvertiserOk(false); return }
        setAdvertiserOk(true)
        const d = await r.json()
        const wa = (d.advertiser?.whatsapp_number ?? '').replace(/\D/g, '')
        if (wa) {
          setAdvertiserWa(wa)
          setForm(prev => prev.cta_value ? prev : { ...prev, cta_value: wa })
        }
      })
      .catch(() => setAdvertiserOk(false))
  }, [])

  useEffect(() => {
    if (form.plan_id && plans.length > 0) {
      const p = plans.find(pl => pl.id === form.plan_id)
      if (p) {
        setSelectedPlan(prev => {
          // Reset district/wards whenever switching to a different geo_scope
          // (e.g. Wilaya → Kata) — a district/ward chosen under one scope
          // isn't necessarily meaningful under another.
          if (!prev || prev.geo_scope !== p.geo_scope) {
            set('target_district', '')
            setTargetWards([])
          }
          return p
        })
        set('ad_type', p.ad_type)
      }
    }
  }, [form.plan_id, plans])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan) { setError(t('adv_select_plan_error')); return }
    if (selectedPlan.geo_scope === 'district' && !form.target_district) {
      setError(t('adv_select_district_error')); return
    }
    if (selectedPlan.geo_scope === 'ward' && (!form.target_district || targetWards.length === 0)) {
      setError(targetWards.length === 0 ? t('adv_select_ward_error') : t('adv_select_district_error'))
      return
    }
    setLoading(true); setError('')
    try {
      const body = {
        ...form,
        target_district: selectedPlan.geo_scope === 'region' ? '' : form.target_district,
        target_wards:    selectedPlan.geo_scope === 'ward' ? targetWards : [],
      }
      const res = await fetch('/api/v1/advertising/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('common_error'))
        return
      }
      // Campaign is always created now (never blocked by a full slot — see
      // slotManager.ts's auto-queue system, which handles that at the
      // actual go-live moment instead). Show creative upload step next.
      setCreatedCampaignId(data.campaign.id)
    } catch { setError(t('adv_connection_error')) }
    finally { setLoading(false) }
  }

  // ── Creative upload step (shown after campaign is created) ──
  if (createdCampaignId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</span>
            <span className="text-sm text-green-600 font-medium">{t('adv_campaign_created')}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t('adv_upload_creative_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('adv_upload_creative_desc')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <UploadCreative
            campaignId={createdCampaignId}
            onDone={() => router.push('/advertising/dashboard?created=1')}
            onSkip={() => router.push('/advertising/dashboard?created=1')}
          />
        </div>
      </div>
    )
  }

  if (advertiserOk === false) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{t('adv_account_not_found')}</h2>
        <p className="text-gray-500 text-sm mb-6">{t('adv_register_first')}</p>
        <a href="/advertising/register" className="bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition">
          {t('adv_register_free')}
        </a>
      </div>
    )
  }

  const byType = plans.reduce<Record<string, Plan[]>>((acc, p) => {
    if (!acc[p.ad_type]) acc[p.ad_type] = []
    acc[p.ad_type].push(p)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('adv_new_campaign_title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('adv_new_campaign_subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={submit} className="space-y-5">
        {/* Plan selection */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-bold text-gray-700 mb-3">{t('adv_step1_choose_plan')}</h2>
          {Object.entries(byType).map(([type, typePlans]) => (
            <div key={type} className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{TYPE_LABELS[type] ?? type}</h3>
              <div className="grid grid-cols-1 gap-2">
                {typePlans.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      form.plan_id === p.id
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio" name="plan_id" value={p.id}
                      checked={form.plan_id === p.id}
                      onChange={() => set('plan_id', p.id)}
                      className="accent-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-primary-600 text-sm">TZS {p.price_tzs.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">{t('adv_days_label')} {p.duration_days}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="text-sm text-gray-400">{t('adv_plans_loading')}</p>
          )}
        </div>

        {selectedPlan && (
          <>
            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">{t('adv_step2_content')}</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('adv_campaign_title_label')} *</label>
                  <input
                    required value={form.title}
                    onChange={e => set('title', e.target.value)}
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder={t('adv_campaign_title_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('adv_campaign_desc_label')}</label>
                  <textarea
                    value={form.body_text}
                    onChange={e => set('body_text', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    placeholder={t('adv_campaign_desc_placeholder')}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700">
                  📸 {t('adv_creative_next_hint')}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">{t('adv_step3_cta')}</h2>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {CTA_TYPES.map(ct => (
                  <label
                    key={ct.value}
                    className={`text-center p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition ${
                      form.cta_type === ct.value
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio" name="cta_type" value={ct.value}
                      checked={form.cta_type === ct.value}
                      onChange={() => set('cta_type', ct.value)}
                      className="sr-only"
                    />
                    {ct.label}
                  </label>
                ))}
              </div>

              <input
                required value={form.cta_value}
                onChange={e => set('cta_value', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder={CTA_TYPES.find(ct => ct.value === form.cta_type)?.placeholder ?? ''}
              />
              {form.cta_type === 'whatsapp' && advertiserWa && form.cta_value === advertiserWa && (
                <p className="text-xs text-green-600 mt-1">
                  ✅ {t('adv_from_profile')}
                </p>
              )}
            </div>

            {/* Targeting */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">{t('adv_step4_targeting')}</h2>

              {/* geo_scope badge — which granularity the chosen plan is priced for */}
              <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                📍 {t('adv_geo_scope_label')}:{' '}
                {selectedPlan.geo_scope === 'ward'     ? t('adv_geo_scope_ward')
                  : selectedPlan.geo_scope === 'district' ? t('adv_geo_scope_district')
                  : t('adv_geo_scope_region')}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('adv_target_region')} *</label>
                  <select
                    required value={form.target_region}
                    onChange={e => { set('target_region', e.target.value); set('target_district', ''); setTargetWards([]) }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="">{t('adv_select_region')}</option>
                    {(REGION_NAMES ?? []).map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {(selectedPlan.geo_scope === 'district' || selectedPlan.geo_scope === 'ward') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('adv_target_district')} *
                    </label>
                    <select
                      required
                      disabled={!form.target_region}
                      value={form.target_district}
                      onChange={e => { set('target_district', e.target.value); setTargetWards([]) }}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">{t('adv_select_district')}</option>
                      {form.target_region && getDistricts(form.target_region).map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedPlan.geo_scope === 'ward' && form.target_district && (() => {
                  const wards = getWards(form.target_region, form.target_district)
                  if (wards.length === 0) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                        ⚠️ {t('adv_no_wards_data')}
                      </div>
                    )
                  }
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('adv_select_wards')} *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {wards.map(w => (
                          <button
                            key={w} type="button"
                            onClick={() => toggleWard(w)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                              targetWards.includes(w)
                                ? 'border-primary-400 bg-primary-50 text-primary-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {targetWards.includes(w) ? '✓ ' : ''}{w}
                          </button>
                        ))}
                      </div>
                      {targetWards.length > 0 && (
                        <p className="text-xs text-primary-700 font-semibold mt-2">
                          💰 {t('adv_ward_price_total')
                            .replace('{{n}}', String(targetWards.length))
                            .replace('{{unit}}', selectedPlan.price_tzs.toLocaleString())}
                          {' '}= TZS {(selectedPlan.price_tzs * targetWards.length).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition disabled:opacity-50"
            >
              {loading ? t('adv_submitting') : t('adv_submit_campaign')}
            </button>

            <p className="text-xs text-center text-gray-400">
              {t('adv_review_notice')}
            </p>
          </>
        )}
      </form>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewCampaignForm />
    </Suspense>
  )
}
