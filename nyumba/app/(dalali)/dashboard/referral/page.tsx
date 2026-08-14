'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

interface ReferralStats {
  total_referred: number; credited: number; pending: number; total_days: number
}
interface Referral {
  id: string; status: string; reward_days: number; created_at: string
  referred: { full_name: string | null; created_at: string } | null
}

export default function ReferralPage() {
  const { t } = useLanguage()
  const [code,    setCode]    = useState('')
  const [link,    setLink]    = useState('')
  const [stats,   setStats]   = useState<ReferralStats | null>(null)
  const [refs,    setRefs]    = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    fetch('/api/v1/dalali/referral')
      .then(r => r.json())
      .then(d => {
        setCode(d.referral_code ?? '')
        setLink(d.referral_link ?? '')
        setStats(d.stats ?? null)
        setRefs(d.referrals ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareWhatsApp() {
    const text = `Jiunge na NyumbaFasta — jukwaa bora la madalali Tanzania! 🏠\n\nTumia kiungo changu na upate faida maalum:\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const MONTHS = ['','Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des']
  function dateFmt(iso: string) {
    const d = new Date(iso)
    return `${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear()}`
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/dashboard/profile" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white">
            <i className="ti ti-arrow-left text-lg" />
          </Link>
          <div>
            <h1 className="text-white text-lg font-bold">{t('ref_title')}</h1>
            <p className="text-green-100 text-xs">{t('ref_subtitle')}</p>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total_referred}</p>
              <p className="text-[11px] text-green-100 mt-0.5">{t('ref_stat_invited')}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.credited}</p>
              <p className="text-[11px] text-green-100 mt-0.5">{t('ref_stat_rewarded')}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total_days}</p>
              <p className="text-[11px] text-green-100 mt-0.5">{t('ref_stat_days_earned')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* How it works */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="font-bold text-gray-900 mb-3 text-sm">{t('ref_how_title')}</h2>
              <div className="space-y-3">
                {([
                  { n: '1', key: 'ref_step1' },
                  { n: '2', key: 'ref_step2' },
                  { n: '3', key: 'ref_step3' },
                ] as const).map(s => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{s.n}</div>
                    <p className="text-sm text-gray-600 pt-0.5 leading-relaxed">{t(s.key)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Referral code */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="font-bold text-gray-900 mb-3 text-sm">{t('ref_code_section')}</h2>
              <div className="bg-primary-50 rounded-xl p-3 flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{t('ref_code_label')}</p>
                  <p className="text-2xl font-bold text-primary-600 tracking-widest">{code || '——'}</p>
                </div>
                <button
                  onClick={copyLink}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-primary-500 text-white hover:bg-primary-600'}`}
                >
                  {copied ? t('ref_copied') : t('ref_copy_link')}
                </button>
              </div>
              {link && (
                <p className="text-xs text-gray-400 break-all bg-gray-50 rounded-lg px-3 py-2">{link}</p>
              )}
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareWhatsApp}
                className="flex items-center justify-center gap-2 bg-green-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                <i className="ti ti-brand-whatsapp text-lg" /> {t('ref_share_whatsapp')}
              </button>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                <i className="ti ti-copy text-lg" /> {copied ? t('ref_copied') : t('ref_copy_link')}
              </button>
            </div>

            {/* Referral history */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h2 className="font-bold text-gray-900 text-sm">{t('ref_history_title').replace('{{n}}', String(refs.length))}</h2>
              </div>
              {refs.length === 0 ? (
                <div className="p-8 text-center">
                  <i className="ti ti-users text-3xl text-gray-200 block mb-2" />
                  <p className="text-sm text-gray-400">{t('ref_history_empty')}</p>
                  <p className="text-xs text-gray-300 mt-1">{t('ref_history_empty_sub')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {refs.map(r => {
                    const referred = r.referred as { full_name?: string | null; created_at?: string } | null
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <i className="ti ti-user text-gray-400 text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{referred?.full_name ?? 'Dalali'}</p>
                          <p className="text-xs text-gray-400">{referred?.created_at ? dateFmt(referred.created_at) : '—'}</p>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${r.status === 'credited' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {r.status === 'credited' ? (
                            <><i className="ti ti-circle-check text-sm" /> {t('ref_days_earned').replace('{{n}}', String(r.reward_days))}</>
                          ) : (
                            <><i className="ti ti-clock text-sm" /> {t('ref_status_pending')}</>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
