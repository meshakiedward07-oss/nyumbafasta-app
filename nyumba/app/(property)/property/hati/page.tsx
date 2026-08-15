'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

// Documents are aggregated from existing records that have document_url fields:
// leases.document_url, management_agreements.document_url, kyc_submissions.*_url

type HatiSource = 'mkataba' | 'makubaliano' | 'kyc'

interface HatiItem {
  id:        string
  title:     string
  type:      HatiSource
  url:       string
  date:      string
  related:   string | null  // e.g. tenant name or listing title
}

const SOURCE_ICONS: Record<HatiSource, string> = {
  mkataba:    'file-text',
  makubaliano:'file-check',
  kyc:        'id',
}

const SOURCE_COLORS: Record<HatiSource, string> = {
  mkataba:    'bg-blue-50 text-blue-600',
  makubaliano:'bg-green-50 text-green-600',
  kyc:        'bg-purple-50 text-purple-600',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileExtension(url: string) {
  const part = url.split('?')[0].split('.').pop()?.toUpperCase() ?? 'FILE'
  return part.length <= 5 ? part : 'FILE'
}

export default function HatiPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [hati,     setHati]    = useState<HatiItem[]>([])
  const [loading,  setLoading] = useState(true)
  const [filter,   setFilter]  = useState<HatiSource | 'all'>('all')
  const [search,   setSearch]  = useState('')

  const SOURCE_LABELS: Record<HatiSource, string> = {
    mkataba:    t('pr_hati_source_lease'),
    makubaliano:t('pr_hati_source_mgmt'),
    kyc:        t('pr_hati_source_id'),
  }
  const FILTERS: { value: HatiSource | 'all'; label: string }[] = [
    { value: 'all',         label: t('pr_hati_filter_all')    },
    { value: 'mkataba',     label: t('pr_hati_filter_mkataba') },
    { value: 'makubaliano', label: t('pr_hati_filter_agree')  },
    { value: 'kyc',         label: t('pr_hati_filter_kyc')    },
  ]

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const orgId = primary.organization.id

        // Fetch leases with document_url
        const leasesRes  = await fetch(`/api/v1/organizations/${orgId}/leases`)
        const leasesData = await leasesRes.json()

        // Fetch agreements + KYC in parallel
        const [agreeRes, kycRes] = await Promise.all([
          fetch(`/api/v1/organizations/${orgId}/agreements`),
          fetch('/api/v1/kyc'),
        ])
        const agreeData = await agreeRes.json()
        const kycData   = await kycRes.json()

        const items: HatiItem[] = []

        // Leases with documents
        for (const l of leasesData.leases ?? []) {
          if (l.document_url) {
            const tenant = (l.tenant as { full_name: string | null } | null)?.full_name ?? t('pr_hati_default_tenant')
            items.push({
              id:      `lease-${l.id}`,
              title:   `${t('pr_hati_lease_prefix')} ${tenant}`,
              type:    'mkataba',
              url:     l.document_url,
              date:    l.created_at,
              related: tenant,
            })
          }
        }

        // Agreements with documents
        for (const a of agreeData.agreements ?? []) {
          if (a.document_url) {
            items.push({
              id:      `agree-${a.id}`,
              title:   t('pr_hati_source_mgmt'),
              type:    'makubaliano',
              url:     a.document_url,
              date:    a.created_at,
              related: a.listing?.title ?? null,
            })
          }
        }

        // KYC submissions
        const kyc = kycData.submission as { id: string; submitted_at: string; id_document_url?: string; title_deed_url?: string; tax_cert_url?: string } | null
        if (kyc) {
          if (kyc.id_document_url) items.push({ id: `kyc-id-${kyc.id}`, title: t('pr_hati_kyc_id_title'), type: 'kyc', url: kyc.id_document_url, date: kyc.submitted_at, related: 'KYC' })
          if (kyc.title_deed_url)  items.push({ id: `kyc-deed-${kyc.id}`, title: t('pr_hati_kyc_deed_title'), type: 'kyc', url: kyc.title_deed_url, date: kyc.submitted_at, related: 'KYC' })
          if (kyc.tax_cert_url)    items.push({ id: `kyc-tax-${kyc.id}`, title: t('pr_hati_kyc_tax_title'), type: 'kyc', url: kyc.tax_cert_url, date: kyc.submitted_at, related: 'KYC' })
        }

        // Sort by date descending
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setHati(items)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = hati.filter(h => {
    const matchType   = filter === 'all' || h.type === filter
    const matchSearch = !search.trim() ||
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      (h.related ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('pr_hati_title')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? '...' : `${hati.length} ${t('pr_hati_count')} ${t('pr_hati_found')}`}
            </p>
          </div>
        </div>

        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('pr_hati_search_ph')}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2"
        />

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <i className="ti ti-folder text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">
              {hati.length === 0 ? t('pr_hati_empty_title') : t('pr_hati_no_results')}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {hati.length === 0 ? t('pr_hati_empty_desc') : t('pr_hati_no_results_desc')}
            </p>
            {hati.length === 0 && (
              <div className="mt-4 space-y-2">
                <Link href="/property/wapangaji" className="block text-sm text-primary-600 hover:underline">
                  {t('pr_hati_add_via_leases')}
                </Link>
                <Link href="/property/agreements" className="block text-sm text-primary-600 hover:underline">
                  {t('pr_hati_add_via_agree')}
                </Link>
              </div>
            )}
          </div>
        ) : (
          filtered.map(h => (
            <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer">
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-primary-200 hover:bg-primary-50/20 transition cursor-pointer">
                {/* File type icon */}
                <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${SOURCE_COLORS[h.type]}`}>
                  <i className={`ti ti-${SOURCE_ICONS[h.type]} text-lg`} aria-hidden="true" />
                  <span className="text-[9px] font-bold mt-0.5 leading-none">{fileExtension(h.url)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{h.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[h.type]}`}>
                      {SOURCE_LABELS[h.type]}
                    </span>
                    <span className="text-[10px] text-gray-400">{fmtDate(h.date)}</span>
                  </div>
                  {h.related && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{h.related}</p>
                  )}
                </div>

                <i className="ti ti-external-link text-gray-300 flex-shrink-0" aria-hidden="true" />
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
