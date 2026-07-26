'use client'
import { useEffect, useState, useCallback } from 'react'

interface StaffMember {
  id:                       string
  full_name:                string | null
  phone:                    string | null
  staff_title:              string | null
  staff_active:             boolean
  max_leads_capacity:       number
  active_managed_properties: number
  max_property_capacity:    number
  active_leads:             number
  assigned_requests: {
    total: number; kyc: number; listing: number; management: number
  }
}
interface WorkloadSummary {
  total_staff: number; active_staff: number
  overloaded: number; pending_requests: number
}

function pct(used: number, cap: number) {
  if (cap <= 0) return 0
  return Math.min(100, Math.round((used / cap) * 100))
}
function barColor(p: number) {
  if (p >= 90) return 'bg-red-400'
  if (p >= 70) return 'bg-amber-400'
  return 'bg-primary-500'
}
function textColor(p: number) {
  if (p >= 90) return 'text-red-600'
  if (p >= 70) return 'text-amber-600'
  return 'text-gray-600'
}

function LoadBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const p = pct(used, cap)
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={`font-semibold ${textColor(p)}`}>
          {cap > 0 ? `${used}/${cap} (${p}%)` : `${used} (hakuna kikomo)`}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor(p)}`} style={{ width: cap > 0 ? `${p}%` : '0%' }} />
      </div>
    </div>
  )
}

function CapacityEditor({ staffId, current, onSaved }: { staffId: string; current: number; onSaved: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(String(current))
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    const res  = await fetch('/api/v1/admin/workload', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, max_capacity: parseInt(value) || 0 }),
    })
    setSaving(false)
    if (res.ok) { onSaved(parseInt(value) || 0); setEditing(false) }
  }

  if (!editing) return (
    <button onClick={() => { setValue(String(current)); setEditing(true) }}
      className="text-[10px] text-primary-600 hover:underline font-medium">
      {current > 0 ? `Kikomo: ${current}` : 'Weka kikomo'}
    </button>
  )

  return (
    <div className="flex items-center gap-1 mt-1">
      <input type="number" value={value} onChange={e => setValue(e.target.value)}
        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300" />
      <button onClick={save} disabled={saving}
        className="px-2 py-1 bg-primary-500 text-white text-[10px] rounded-lg font-medium disabled:opacity-40">
        {saving ? '...' : 'Hifadhi'}
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-400 text-[10px] hover:text-gray-600">✕</button>
    </div>
  )
}

export default function WorkloadPage() {
  const [staff,   setStaff]   = useState<StaffMember[]>([])
  const [summary, setSummary] = useState<WorkloadSummary>({ total_staff: 0, active_staff: 0, overloaded: 0, pending_requests: 0 })
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<'cards' | 'table'>('cards')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/admin/workload')
      const data = await res.json()
      setStaff(data.staff ?? [])
      if (data.summary) setSummary(data.summary)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function updateCapacity(staffId: string, cap: number) {
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, max_property_capacity: cap } : s))
  }

  const active   = staff.filter(s => s.staff_active)
  const inactive = staff.filter(s => !s.staff_active)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mzigo wa Wafanyakazi</h1>
          <p className="text-sm text-gray-400 mt-0.5">Simamia mgawanyo wa kazi kwa timu ya NyumbaFasta</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setView('cards')}
            className={`p-2 rounded-xl border text-sm transition ${view === 'cards' ? 'border-primary-300 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <i className="ti ti-layout-grid" aria-hidden="true" />
          </button>
          <button onClick={() => setView('table')}
            className={`p-2 rounded-xl border text-sm transition ${view === 'table' ? 'border-primary-300 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <i className="ti ti-table" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Wafanyakazi Wote',    value: summary.total_staff,      color: 'bg-gray-50  border-gray-100  text-gray-700',    icon: 'users'         },
          { label: 'Wanaofanya Kazi',     value: summary.active_staff,     color: 'bg-green-50 border-green-100 text-green-700',   icon: 'user-check'    },
          { label: 'Waliozidiwa Mzigo',   value: summary.overloaded,       color: summary.overloaded > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-500', icon: 'alert-circle' },
          { label: 'Maombi Yaliyopewa',   value: summary.pending_requests, color: 'bg-amber-50 border-amber-100 text-amber-700',   icon: 'clipboard'     },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <i className={`ti ti-${c.icon} text-base`} aria-hidden="true" />
              <span className="text-2xl font-bold">{c.value}</span>
            </div>
            <p className="text-xs font-medium opacity-80">{c.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
          <i className="ti ti-users text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna wafanyakazi waliosajiliwa</p>
          <p className="text-sm text-gray-400 mt-1">Nenda Admin → Wafanyakazi kuongeza.</p>
        </div>
      ) : view === 'cards' ? (
        <>
          {/* Active staff */}
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Wanaofanya Kazi ({active.length})</p>
              <div className="grid md:grid-cols-2 gap-3">
                {active.map(s => {
                  const propPct  = pct(s.active_managed_properties, s.max_property_capacity)
                  const leadPct  = pct(s.active_leads, s.max_leads_capacity)
                  const isOverloaded = (s.max_property_capacity > 0 && s.active_managed_properties >= s.max_property_capacity)
                                    || (s.max_leads_capacity > 0 && s.active_leads >= s.max_leads_capacity)

                  return (
                    <div key={s.id} className={`bg-white rounded-2xl border p-4 ${isOverloaded ? 'border-red-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverloaded ? 'bg-red-50' : 'bg-primary-50'}`}>
                            <span className={`text-lg font-bold ${isOverloaded ? 'text-red-500' : 'text-primary-600'}`}>
                              {(s.full_name ?? 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{s.full_name ?? 'Mfanyakazi'}</p>
                            <p className="text-xs text-gray-400">{s.staff_title ?? 'Afisa'}</p>
                          </div>
                        </div>
                        {isOverloaded && (
                          <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                            Amezidiwa
                          </span>
                        )}
                      </div>

                      <div className="space-y-2.5 mb-3">
                        <LoadBar label="Mali Zinazoshughulikiwa" used={s.active_managed_properties} cap={s.max_property_capacity} />
                        <LoadBar label="Leads Zilizo Hai" used={s.active_leads} cap={s.max_leads_capacity} />
                      </div>

                      {/* Assigned service requests breakdown */}
                      {s.assigned_requests.total > 0 && (
                        <div className="flex gap-2 flex-wrap mb-3">
                          {s.assigned_requests.kyc > 0 && (
                            <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              {s.assigned_requests.kyc} KYC
                            </span>
                          )}
                          {s.assigned_requests.listing > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {s.assigned_requests.listing} Matangazo
                            </span>
                          )}
                          {s.assigned_requests.management > 0 && (
                            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                              {s.assigned_requests.management} Usimamizi
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="text-xs text-gray-400 hover:text-primary-600 transition">
                            <i className="ti ti-phone mr-0.5" aria-hidden="true" />{s.phone}
                          </a>
                        )}
                        <CapacityEditor
                          staffId={s.id}
                          current={s.max_property_capacity}
                          onSaved={cap => updateCapacity(s.id, cap)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inactive staff */}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Hawafanyi Kazi ({inactive.length})</p>
              <div className="space-y-2">
                {inactive.map(s => (
                  <div key={s.id} className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 opacity-60">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-gray-400">{(s.full_name ?? 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{s.full_name ?? 'Mfanyakazi'}</p>
                      <p className="text-xs text-gray-400">{s.staff_title ?? 'Afisa'} · Hayafanyi kazi</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Table view */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium">Mfanyakazi</th>
                  <th className="text-center px-3 py-3 font-medium">Mali</th>
                  <th className="text-center px-3 py-3 font-medium">Leads</th>
                  <th className="text-center px-3 py-3 font-medium">Maombi</th>
                  <th className="text-center px-3 py-3 font-medium">Hali</th>
                  <th className="text-left px-3 py-3 font-medium">Kikomo cha Mali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(s => {
                  const propPct = pct(s.active_managed_properties, s.max_property_capacity)
                  const leadPct = pct(s.active_leads, s.max_leads_capacity)
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50/50 ${!s.staff_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{s.staff_title ?? 'Afisa'}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold ${textColor(propPct)}`}>{s.active_managed_properties}</span>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <span className="text-gray-400 text-xs">{s.max_property_capacity || '∞'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold ${textColor(leadPct)}`}>{s.active_leads}</span>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <span className="text-gray-400 text-xs">{s.max_leads_capacity || '∞'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-gray-700 font-medium">{s.assigned_requests.total}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.staff_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.staff_active ? 'Hai' : 'Amepumzika'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <CapacityEditor
                          staffId={s.id}
                          current={s.max_property_capacity}
                          onSaved={cap => updateCapacity(s.id, cap)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">Mwongozo wa Rangi</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-500" />Salama (chini ya 70%)</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" />Tahadhari (70–89%)</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400" />Amezidiwa (90%+)</div>
        </div>
      </div>
    </div>
  )
}
