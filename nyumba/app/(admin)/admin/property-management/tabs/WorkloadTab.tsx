'use client'
import { useEffect, useState, useCallback } from 'react'

interface StaffMember {
  id:                        string
  full_name:                 string | null
  phone:                     string | null
  staff_title:               string | null
  staff_active:              boolean
  max_leads_capacity:        number
  active_managed_properties: number
  max_property_capacity:     number
  active_leads:              number
  assigned_requests: { total: number; kyc: number; listing: number; management: number }
}
interface WorkloadSummary {
  total_staff: number; active_staff: number; overloaded: number; pending_requests: number
}

function pct(used: number, cap: number) {
  if (cap <= 0) return 0
  return Math.min(100, Math.round((used / cap) * 100))
}
function barBg(p: number) {
  if (p >= 90) return '#ef4444'
  if (p >= 70) return '#f59e0b'
  return '#1D9E75'
}
function textStyle(p: number): { color: string } {
  if (p >= 90) return { color: '#a32d2d' }
  if (p >= 70) return { color: '#854f0b' }
  return { color: '#666660' }
}

function LoadBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const p = pct(used, cap)
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span style={{ color: '#999992' }}>{label}</span>
        <span className="font-semibold" style={textStyle(p)}>
          {cap > 0 ? `${used}/${cap} (${p}%)` : `${used} (hakuna kikomo)`}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f4f4f0' }}>
        <div className="h-full rounded-full transition-all" style={{ width: cap > 0 ? `${p}%` : '0%', background: barBg(p) }} />
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
    const res = await fetch('/api/v1/admin/workload', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, max_capacity: parseInt(value) || 0 }),
    })
    setSaving(false)
    if (res.ok) { onSaved(parseInt(value) || 0); setEditing(false) }
  }

  if (!editing) return (
    <button onClick={() => { setValue(String(current)); setEditing(true) }}
      className="text-[10px] font-medium hover:underline" style={{ color: '#1D9E75' }}>
      {current > 0 ? `Kikomo: ${current}` : 'Weka kikomo'}
    </button>
  )

  return (
    <div className="flex items-center gap-1 mt-1">
      <input type="number" value={value} onChange={e => setValue(e.target.value)}
        className="w-16 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
        style={{ border: '1px solid #e5e5e0' }} />
      <button onClick={save} disabled={saving}
        className="px-2 py-1 bg-primary-500 text-white text-[10px] rounded-lg font-medium disabled:opacity-40">
        {saving ? '...' : 'Hifadhi'}
      </button>
      <button onClick={() => setEditing(false)} className="text-[10px] hover:opacity-70" style={{ color: '#999992' }}>✕</button>
    </div>
  )
}

export default function WorkloadTab() {
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
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1.5">
          <button onClick={() => setView('cards')}
            className={`p-2 rounded-xl transition ${view === 'cards' ? 'bg-primary-50 text-primary-600' : ''}`}
            style={view !== 'cards' ? { border: '1px solid #e5e5e0', color: '#999992' } : { border: '1px solid #1D9E75' }}>
            <i className="ti ti-layout-grid" aria-hidden="true" />
          </button>
          <button onClick={() => setView('table')}
            className={`p-2 rounded-xl transition ${view === 'table' ? 'bg-primary-50 text-primary-600' : ''}`}
            style={view !== 'table' ? { border: '1px solid #e5e5e0', color: '#999992' } : { border: '1px solid #1D9E75' }}>
            <i className="ti ti-table" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Wafanyakazi Wote',  value: summary.total_staff,      icon: 'users',         bg: '#f4f4f0', color: '#1a1a18'  },
          { label: 'Wanaofanya Kazi',   value: summary.active_staff,     icon: 'user-check',    bg: '#eaf3de', color: '#3b6d11'  },
          { label: 'Waliozidiwa Mzigo', value: summary.overloaded,       icon: 'alert-circle',  bg: summary.overloaded > 0 ? '#fcebeb' : '#f4f4f0', color: summary.overloaded > 0 ? '#a32d2d' : '#999992' },
          { label: 'Maombi Yaliyopewa', value: summary.pending_requests, icon: 'clipboard',     bg: '#faeeda', color: '#854f0b'  },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                <i className={`ti ti-${c.icon} text-sm`} style={{ color: c.color }} aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</span>
            </div>
            <p className="text-xs font-medium" style={{ color: '#999992' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl" style={{ border: '1px solid #e5e5e0' }}>
          <i className="ti ti-users text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
          <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna wafanyakazi waliosajiliwa</p>
          <p className="text-sm mt-1" style={{ color: '#999992' }}>Nenda Admin → Wafanyakazi kuongeza.</p>
        </div>
      ) : view === 'cards' ? (
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#999992' }}>Wanaofanya Kazi ({active.length})</p>
              <div className="grid md:grid-cols-2 gap-3">
                {active.map(s => {
                  const propPct      = pct(s.active_managed_properties, s.max_property_capacity)
                  const isOverloaded = (s.max_property_capacity > 0 && s.active_managed_properties >= s.max_property_capacity)
                                    || (s.max_leads_capacity > 0 && s.active_leads >= s.max_leads_capacity)

                  return (
                    <div key={s.id} className="bg-white rounded-xl p-4" style={{
                      border: `1px solid ${isOverloaded ? '#fcebeb' : '#e5e5e0'}`,
                    }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isOverloaded ? '#fcebeb' : '#e6f1fb' }}>
                            <span className="text-lg font-bold" style={{ color: isOverloaded ? '#a32d2d' : '#185fa5' }}>
                              {(s.full_name ?? 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: '#1a1a18' }}>{s.full_name ?? 'Mfanyakazi'}</p>
                            <p className="text-xs" style={{ color: '#999992' }}>{s.staff_title ?? 'Afisa'}</p>
                          </div>
                        </div>
                        {isOverloaded && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{ background: '#fcebeb', color: '#a32d2d', border: '1px solid #fcebeb' }}>
                            Amezidiwa
                          </span>
                        )}
                      </div>

                      <div className="space-y-2.5 mb-3">
                        <LoadBar label="Mali Zinazoshughulikiwa" used={s.active_managed_properties} cap={s.max_property_capacity} />
                        <LoadBar label="Leads Zilizo Hai"        used={s.active_leads}              cap={s.max_leads_capacity}     />
                      </div>

                      {s.assigned_requests.total > 0 && (
                        <div className="flex gap-2 flex-wrap mb-3">
                          {s.assigned_requests.kyc > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#eeedfe', color: '#534ab7' }}>
                              {s.assigned_requests.kyc} KYC
                            </span>
                          )}
                          {s.assigned_requests.listing > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e6f1fb', color: '#185fa5' }}>
                              {s.assigned_requests.listing} Matangazo
                            </span>
                          )}
                          {s.assigned_requests.management > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#3b6d11' }}>
                              {s.assigned_requests.management} Usimamizi
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid #f4f4f0' }}>
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="text-xs hover:text-primary-600 transition" style={{ color: '#999992' }}>
                            <i className="ti ti-phone mr-0.5" aria-hidden="true" />{s.phone}
                          </a>
                        )}
                        <CapacityEditor staffId={s.id} current={s.max_property_capacity} onSaved={cap => updateCapacity(s.id, cap)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#e5e5e0' }}>Hawafanyi Kazi ({inactive.length})</p>
              <div className="space-y-2">
                {inactive.map(s => (
                  <div key={s.id} className="rounded-xl px-4 py-3 flex items-center gap-3 opacity-60"
                    style={{ background: '#f8f8f5', border: '1px solid #e5e5e0' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e5e5e0' }}>
                      <span className="text-sm font-bold" style={{ color: '#999992' }}>{(s.full_name ?? 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#666660' }}>{s.full_name ?? 'Mfanyakazi'}</p>
                      <p className="text-xs" style={{ color: '#999992' }}>{s.staff_title ?? 'Afisa'} · Hayafanyi kazi</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider font-medium" style={{ borderBottom: '1px solid #e5e5e0', background: '#f8f8f5', color: '#999992' }}>
                  <th className="text-left px-4 py-3">Mfanyakazi</th>
                  <th className="text-center px-3 py-3">Mali</th>
                  <th className="text-center px-3 py-3">Leads</th>
                  <th className="text-center px-3 py-3">Maombi</th>
                  <th className="text-center px-3 py-3">Hali</th>
                  <th className="text-left px-3 py-3">Kikomo cha Mali</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const pp = pct(s.active_managed_properties, s.max_property_capacity)
                  const lp = pct(s.active_leads, s.max_leads_capacity)
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50/50 ${!s.staff_active ? 'opacity-50' : ''}`}
                      style={{ borderBottom: '1px solid #f4f4f0' }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: '#1a1a18' }}>{s.full_name ?? '—'}</p>
                        <p className="text-xs" style={{ color: '#999992' }}>{s.staff_title ?? 'Afisa'}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold" style={textStyle(pp)}>{s.active_managed_properties}</span>
                        <span style={{ color: '#e5e5e0' }}>/</span>
                        <span className="text-xs" style={{ color: '#999992' }}>{s.max_property_capacity || '∞'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold" style={textStyle(lp)}>{s.active_leads}</span>
                        <span style={{ color: '#e5e5e0' }}>/</span>
                        <span className="text-xs" style={{ color: '#999992' }}>{s.max_leads_capacity || '∞'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-medium" style={{ color: '#1a1a18' }}>{s.assigned_requests.total}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={s.staff_active ? { background: '#eaf3de', color: '#3b6d11' } : { background: '#f4f4f0', color: '#999992' }}>
                          {s.staff_active ? 'Hai' : 'Amepumzika'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <CapacityEditor staffId={s.id} current={s.max_property_capacity} onSaved={cap => updateCapacity(s.id, cap)} />
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
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#999992' }}>Mwongozo wa Rangi</p>
        <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#666660' }}>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: '#1D9E75' }} />Salama (chini ya 70%)</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />Tahadhari (70–89%)</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />Amezidiwa (90%+)</div>
        </div>
      </div>
    </div>
  )
}
