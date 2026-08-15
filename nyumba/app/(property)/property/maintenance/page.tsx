'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import {
  MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_PRIORITY_LABELS, MAINTENANCE_STATUS_LABELS,
  PRIORITY_COLORS, STATUS_COLORS,
} from '@/lib/types/property'
import type { MaintenanceRequest, MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from '@/lib/types/property'

type RichRequest = MaintenanceRequest & {
  reporter: { id: string; full_name: string | null; phone: string | null; avatar_url: string | null } | null
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  unit:     { id: string; unit_number: string; unit_type: string } | null
  comment_count: Array<{ count: number }>
}

type MaintTab = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'
const STATUS_TABS: MaintTab[] = ['all', 'open', 'in_progress', 'resolved', 'closed']

const MAINT_TAB_KEYS = {
  all:         'pr_maint_tab_all',
  open:        'pr_maint_tab_open',
  in_progress: 'pr_maint_tab_in_progress',
  resolved:    'pr_maint_tab_resolved',
  closed:      'pr_maint_tab_closed',
} as const satisfies Record<MaintTab, string>

const CATEGORIES: MaintenanceCategory[] = ['plumbing','electrical','structural','cleaning','security','appliance','other']
const PRIORITIES: MaintenancePriority[] = ['urgent','high','medium','low']

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins  = Math.floor(diff / 60000)
  if (mins  < 1)  return 'Sasa hivi'
  if (mins  < 60) return `Dakika ${mins}`
  if (hours < 24) return `Saa ${hours}`
  return `Siku ${days}`
}

export default function MaintenancePage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [requests,   setRequests]   = useState<RichRequest[]>([])
  const [orgId,      setOrgId]      = useState<string | null>(null)
  const [units,      setUnits]      = useState<{ id: string; unit_number: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<MaintTab>('all')
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', category: 'other' as MaintenanceCategory,
    priority: 'medium' as MaintenancePriority, unit_id: '',
    estimated_cost: '', scheduled_at: '', notes: '', tenant_phone: '',
  })

  async function load(id: string) {
    const res  = await fetch(`/api/v1/organizations/${id}/maintenance`)
    const data = await res.json()
    setRequests(data.requests ?? [])
  }

  useEffect(() => {
    async function init() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const id = primary.organization.id
        setOrgId(id)
        const [, unitRes] = await Promise.all([
          load(id),
          fetch(`/api/v1/organizations/${id}/units`),
        ])
        const unitData = await unitRes.json()
        setUnits(unitData.units ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    if (!form.title.trim() || !orgId) { setFormError(t('pr_maint_err_title')); return }
    setSubmitting(true); setFormError(null)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/maintenance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          unit_id:        form.unit_id || null,
          estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
          scheduled_at:   form.scheduled_at   || null,
          tenant_phone:   form.tenant_phone   || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? t('pr_err_generic')); return }
      setShowForm(false)
      setForm({ title:'', description:'', category:'other', priority:'medium', unit_id:'',
                estimated_cost:'', scheduled_at:'', notes:'', tenant_phone:'' })
      await load(orgId)
    } catch {
      setFormError(t('pr_network_err'))
    } finally { setSubmitting(false) }
  }

  const filtered = requests.filter(r => tab === 'all' || r.status === tab)

  const openCount      = requests.filter(r => r.status === 'open').length
  const urgentCount    = requests.filter(r => r.priority === 'urgent' && !['closed','cancelled'].includes(r.status)).length
  const resolvedMonth  = requests.filter(r => {
    if (!['resolved','closed'].includes(r.status)) return false
    const d = new Date(r.updated_at), now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('pr_maint_title')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('pr_maint_subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden sm:inline">{t('pr_maint_add')}</span>
          </button>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-blue-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-blue-600">{openCount}</p>
              <p className="text-[10px] text-blue-500 font-medium">{t('pr_maint_summary_open')}</p>
            </div>
            <div className={`${urgentCount > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-xl p-2.5 text-center`}>
              <p className={`text-xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{urgentCount}</p>
              <p className={`text-[10px] font-medium ${urgentCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{t('pr_maint_summary_urgent')}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-green-600">{resolvedMonth}</p>
              <p className="text-[10px] text-green-500 font-medium">{t('pr_maint_summary_month')}</p>
            </div>
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(tabValue => (
            <button key={tabValue} onClick={() => setTab(tabValue)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                tab === tabValue ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {t(MAINT_TAB_KEYS[tabValue])}
              {tabValue !== 'all' && (
                <span className="ml-1 opacity-70">{requests.filter(r => r.status === tabValue).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* New request form — bottom sheet on mobile, inline on desktop */}
      {showForm && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => { setShowForm(false); setFormError(null) }}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl lg:static lg:shadow-none lg:mx-4 lg:mt-3 lg:rounded-2xl lg:border lg:border-gray-100 overflow-y-auto max-h-[88vh] lg:max-h-[70vh]">
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">{t('pr_maint_form_title')}</h3>
                <button
                  onClick={() => { setShowForm(false); setFormError(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                  aria-label="Funga"
                >
                  <i className="ti ti-x text-sm" aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder={t('pr_maint_title_ph')}
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />

                <div className="grid grid-cols-2 gap-2">
                  <select value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value as MaintenanceCategory }))}
                    className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c]}</option>)}
                  </select>
                  <select value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as MaintenancePriority }))}
                    className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    {PRIORITIES.map(pr => <option key={pr} value={pr}>{MAINTENANCE_PRIORITY_LABELS[pr]}</option>)}
                  </select>
                </div>

                {units.length > 0 && (
                  <select value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="">{t('pr_maint_unit_ph')}</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                  </select>
                )}

                <input type="tel" placeholder={t('pr_maint_phone_opt_ph')}
                  value={form.tenant_phone} onChange={e => setForm(p => ({ ...p, tenant_phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />

                <textarea rows={3} placeholder={t('pr_maint_desc_ph')}
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />

                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder={t('pr_maint_cost_ph')}
                    value={form.estimated_cost} onChange={e => setForm(p => ({ ...p, estimated_cost: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <input type="datetime-local"
                    value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>

                {formError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <i className="ti ti-alert-circle" aria-hidden="true" /> {formError}
                  </p>
                )}
                <div className="flex gap-2 pb-2">
                  <button onClick={() => { setShowForm(false); setFormError(null) }}
                    className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-3">
                    {t('pr_maint_cancel')}
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-40">
                    {submitting ? t('pr_maint_submitting') : t('pr_maint_submit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <i className="ti ti-tool text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">
              {requests.length === 0 ? t('pr_maint_empty_title') : t('pr_hati_no_results')}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {requests.length === 0
                ? t('pr_maint_empty_cta')
                : t('pr_maint_filter_clear')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(req => {
              const commentCount = (req.comment_count as unknown as Array<{ count: number }>)?.[0]?.count ?? 0
              return (
                <Link key={req.id} href={`/property/maintenance/${req.id}`}>
                  <div className="flex gap-3 px-4 py-3.5 hover:bg-gray-50 transition cursor-pointer">
                    {/* Priority stripe */}
                    <div className={`w-1 flex-shrink-0 rounded-full self-stretch ${
                      req.priority === 'urgent' ? 'bg-red-400' :
                      req.priority === 'high'   ? 'bg-orange-400' :
                      req.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-200'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900 truncate">{req.title}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(req.created_at)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${PRIORITY_COLORS[req.priority]}`}>
                          {MAINTENANCE_PRIORITY_LABELS[req.priority]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[req.status]}`}>
                          {MAINTENANCE_STATUS_LABELS[req.status]}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          <i className="ti ti-tool mr-0.5" aria-hidden="true" />
                          {MAINTENANCE_CATEGORY_LABELS[req.category]}
                        </span>
                        {req.unit && (
                          <span className="text-[10px] text-gray-400">
                            <i className="ti ti-door mr-0.5" aria-hidden="true" />
                            {req.unit.unit_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-gray-400 truncate">
                          {req.description
                            ? req.description.slice(0, 60) + (req.description.length > 60 ? '…' : '')
                            : t('pr_maint_no_desc')}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {req.assignee && (
                            <span className="text-[10px] text-purple-600">
                              <i className="ti ti-user-check mr-0.5" aria-hidden="true" />
                              {req.assignee.full_name?.split(' ')[0]}
                            </span>
                          )}
                          {commentCount > 0 && (
                            <span className="text-[10px] text-gray-400">
                              <i className="ti ti-message mr-0.5" aria-hidden="true" />{commentCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <i className="ti ti-chevron-right text-gray-300 self-center flex-shrink-0" aria-hidden="true" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
