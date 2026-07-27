'use client'
import { useEffect, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Broker {
  user_id: string
  broker_whatsapp: string | null
  whatsapp_number: string | null
  is_verified: boolean
  subscription_plan: string | null
  broker_user: {
    id: string
    full_name: string | null
    email: string | null
    username: string | null
  } | null
}

interface BrokerageRequest {
  id: string
  title: string
  listing_type: string
  price_monthly: number
  deposit_months: number
  region: string
  district: string
  ward: string | null
  mtaa: string | null
  images: string[]
  org_contact_name: string | null
  org_contact_phone: string
  status: string
  commission_status: string
  commission_amount: number
  rejection_reason: string | null
  agreed_at: string | null
  posted_at: string | null
  deal_closed_at: string | null
  created_at: string
  org: { id: string; name: string; phone: string } | null
  submitter: { id: string; full_name: string | null; phone: string | null } | null
  poster: { id: string; full_name: string | null } | null
  listing: { id: string; title: string; status: string; lifecycle_status: string } | null
}

interface Summary {
  pending: number
  approved: number
  listed: number
  deal_closed: number
  commission_due: number
  commission_invoiced: number
  commission_received: number
}

interface Lead {
  id: string
  created_at: string
  payment_method: string | null
  amount_paid: number | null
  tenant: { id: string; full_name: string | null; phone: string | null } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; pill: string; icon: string }> = {
  pending:     { label: 'Inasubiriwa',  pill: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'clock' },
  approved:    { label: 'Imeidhinishwa',pill: 'bg-blue-50 text-blue-700 border-blue-200',      icon: 'circle-check' },
  rejected:    { label: 'Imekataliwa',  pill: 'bg-red-50 text-red-700 border-red-200',          icon: 'circle-x' },
  listed:      { label: 'Imetangazwa',  pill: 'bg-green-50 text-green-700 border-green-200',   icon: 'speakerphone' },
  deal_closed: { label: 'Deal Imefungwa',pill: 'bg-purple-50 text-purple-700 border-purple-200',icon: 'confetti' },
  cancelled:   { label: 'Imefutwa',     pill: 'bg-gray-100 text-gray-500 border-gray-200',      icon: 'ban' },
}

const COMMISSION_CFG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Bado',          color: 'text-amber-600' },
  invoiced: { label: 'Ankara Imetumwa', color: 'text-blue-600' },
  received: { label: 'Imepokelewa ✓', color: 'text-green-600' },
  waived:   { label: 'Imesamehewa',   color: 'text-gray-400' },
}

function fmt(n: number) { return `TZS ${n.toLocaleString()}` }

function StatCard({ label, value, sub, color = '#1D9E75' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-2xl border p-4" style={{ borderColor: '#e5e5e0' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#999992' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#999992' }}>{sub}</p>}
    </div>
  )
}

interface Me {
  id: string
  role: string
  username: string | null
  is_platform_broker: boolean
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BrokerageTab() {
  const [activeSection, setActiveSection] = useState<'requests' | 'brokers' | 'mine'>('requests')
  const [me, setMe] = useState<Me | null>(null)

  const [requests, setRequests] = useState<BrokerageRequest[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')
  const [search,   setSearch]   = useState('')

  // Detail drawer
  const [detail,     setDetail]     = useState<BrokerageRequest | null>(null)
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [detailLoad, setDetailLoad] = useState(false)

  // Action states
  const [acting,        setActing]        = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)
  const [rejectReason,  setRejectReason]  = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [commAmount,    setCommAmount]    = useState('')
  const [commNotes,     setCommNotes]     = useState('')
  const [selectedBroker, setSelectedBroker] = useState('')

  // Brokers management
  const [brokers,      setBrokers]      = useState<Broker[]>([])
  const [brokersLoad,  setBrokersLoad]  = useState(false)
  const [showBrokerForm, setShowBrokerForm] = useState(false)
  const [brokerName,   setBrokerName]   = useState('')
  const [brokerEmail,  setBrokerEmail]  = useState('')
  const [brokerPass,   setBrokerPass]   = useState('')
  const [brokerWa,     setBrokerWa]     = useState('')
  const [creatingBroker, setCreatingBroker] = useState(false)
  const [brokerError,  setBrokerError]  = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setMe(d.user) })
      .catch(() => {})
  }, [])

  async function loadBrokers() {
    setBrokersLoad(true)
    try {
      const res  = await fetch('/api/v1/admin/brokers')
      const data = await res.json()
      setBrokers(data.brokers ?? [])
    } catch { /* silent */ }
    finally { setBrokersLoad(false) }
  }

  useEffect(() => {
    if (activeSection === 'brokers') loadBrokers()
  }, [activeSection])

  async function handleCreateBroker() {
    setBrokerError(null)
    if (!brokerName.trim() || !brokerEmail.trim() || !brokerPass || !brokerWa.trim()) {
      setBrokerError('Jaza sehemu zote'); return
    }
    setCreatingBroker(true)
    try {
      const res  = await fetch('/api/v1/admin/brokers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:       brokerName.trim(),
          email:           brokerEmail.trim(),
          password:        brokerPass,
          whatsapp_number: brokerWa.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setBrokerError(data.error ?? 'Hitilafu'); return }
      setShowBrokerForm(false)
      setBrokerName(''); setBrokerEmail(''); setBrokerPass(''); setBrokerWa('')
      await loadBrokers()
    } catch {
      setBrokerError('Hitilafu ya mtandao')
    } finally {
      setCreatingBroker(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      if (search) params.set('q', search)
      if (activeSection === 'mine') params.set('mine', '1')
      const res  = await fetch(`/api/v1/admin/brokerage-requests?${params}`)
      const data = await res.json()
      setRequests(data.requests ?? [])
      setSummary(data.summary ?? null)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [filter, search, activeSection])

  useEffect(() => {
    if (activeSection !== 'brokers') load()
  }, [load, activeSection])

  async function openDetail(req: BrokerageRequest) {
    setDetail(req); setDetailLoad(true); setLeads([]); setActionError(null); setSelectedBroker('')
    // Pre-load brokers so the picker is ready
    if (brokers.length === 0) loadBrokers()
    try {
      const res  = await fetch(`/api/v1/admin/brokerage-requests/${req.id}`)
      const data = await res.json()
      if (data.request) setDetail(data.request)
      if (data.leads) setLeads(data.leads)
    } catch { /* silent */ }
    finally { setDetailLoad(false) }
  }

  async function doAction(id: string, body: Record<string, unknown>) {
    setActing(true); setActionError(null)
    try {
      const res  = await fetch(`/api/v1/admin/brokerage-requests/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error ?? 'Hitilafu'); return }
      // Refresh
      setDetail(data.request ?? null)
      await load()
      if (data.request) setDetail(data.request)
    } catch {
      setActionError('Hitilafu ya mtandao')
    } finally {
      setActing(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Section toggle ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['requests', 'brokers', ...(me?.is_platform_broker ? ['mine' as const] : [])] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s as typeof activeSection)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition"
            style={{
              background:  activeSection === s ? '#1a1a18' : 'white',
              color:       activeSection === s ? 'white'   : '#666660',
              borderColor: activeSection === s ? '#1a1a18' : '#e5e5e0',
            }}
          >
            {s === 'requests' ? 'Maombi ya Brokerage' : s === 'brokers' ? 'Brokers' : 'Maombi Yangu'}
          </button>
        ))}

        {/* Broker quick links */}
        {me?.is_platform_broker && (
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/dashboard"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-medium hover:bg-gray-50 transition"
              style={{ borderColor: '#e5e5e0', color: '#1D9E75' }}
            >
              <i className="ti ti-layout-dashboard text-sm" />
              Dalali Dashboard
            </a>
            {me.username && (
              <a
                href={`/agent/${me.username}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-medium hover:bg-gray-50 transition"
                style={{ borderColor: '#e5e5e0', color: '#1D9E75' }}
              >
                <i className="ti ti-world text-sm" />
                Microsite Yangu
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Brokers panel ──────────────────────────────────────────────── */}
      {activeSection === 'brokers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm" style={{ color: '#1a1a18' }}>Brokers wa NyumbaFasta</p>
              <p className="text-xs mt-0.5" style={{ color: '#999992' }}>
                Kila broker ana akaunti ya dalali inayoweza kutangaza bila kikwacho
              </p>
            </div>
            <button
              onClick={() => { setShowBrokerForm(v => !v); setBrokerError(null) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: '#1D9E75' }}
            >
              <i className="ti ti-plus" />
              Broker Mpya
            </button>
          </div>

          {/* Create broker form */}
          {showBrokerForm && (
            <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: '#e5e5e0' }}>
              <p className="font-semibold text-sm mb-4" style={{ color: '#1a1a18' }}>Unda Akaunti ya Broker</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#666660' }}>Jina Kamili *</label>
                  <input
                    value={brokerName} onChange={e => setBrokerName(e.target.value)}
                    placeholder="mfano: Hamisi Juma"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#666660' }}>Barua Pepe *</label>
                  <input
                    type="email" value={brokerEmail} onChange={e => setBrokerEmail(e.target.value)}
                    placeholder="broker@nyumbafasta.com"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#666660' }}>Nenosiri * (hadi 8+)</label>
                  <input
                    type="password" value={brokerPass} onChange={e => setBrokerPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: '#666660' }}>WhatsApp ya Brokerage *</label>
                  <input
                    type="tel" value={brokerWa} onChange={e => setBrokerWa(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                </div>
              </div>
              {brokerError && (
                <p className="text-sm text-red-600 mt-3">
                  <i className="ti ti-alert-circle mr-1" />{brokerError}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowBrokerForm(false); setBrokerError(null) }}
                  className="px-4 py-2.5 border rounded-xl text-sm font-medium"
                  style={{ borderColor: '#e5e5e0', color: '#666660' }}
                >
                  Ghairi
                </button>
                <button
                  onClick={handleCreateBroker}
                  disabled={creatingBroker}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                  style={{ background: '#1D9E75' }}
                >
                  {creatingBroker ? 'Inaunda...' : 'Unda Broker'}
                </button>
              </div>
            </div>
          )}

          {/* Brokers list */}
          {brokersLoad ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#e5e5e0' }} />
              ))}
            </div>
          ) : brokers.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border" style={{ borderColor: '#e5e5e0' }}>
              <i className="ti ti-user-check text-5xl" style={{ color: '#e5e5e0' }} />
              <p className="text-sm font-semibold mt-3" style={{ color: '#1a1a18' }}>Hakuna brokers bado</p>
              <p className="text-xs mt-1" style={{ color: '#999992' }}>Unda akaunti ya broker wa kwanza.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {brokers.map(b => (
                <div key={b.user_id} className="bg-white rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: '#e5e5e0' }}>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                    style={{ background: '#1D9E75' }}
                  >
                    {(b.broker_user?.full_name ?? 'B')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1a1a18' }}>
                      {b.broker_user?.full_name ?? '—'}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#999992' }}>{b.broker_user?.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <a
                      href={`https://wa.me/${(b.broker_whatsapp ?? b.whatsapp_number ?? '').replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium hover:underline flex items-center gap-1 justify-end"
                      style={{ color: '#1D9E75' }}
                    >
                      <i className="ti ti-brand-whatsapp" />
                      {b.broker_whatsapp ?? b.whatsapp_number ?? '—'}
                    </a>
                    {b.broker_user?.username && (
                      <a
                        href={`/agent/${b.broker_user.username}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] flex items-center gap-1 justify-end hover:underline"
                        style={{ color: '#999992' }}
                      >
                        <i className="ti ti-world text-xs" />
                        /agent/{b.broker_user.username}
                      </a>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block bg-green-50 text-green-700">
                      Platform Broker
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(activeSection === 'requests' || activeSection === 'mine') && <>
      {/* ── Summary cards ──────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Inasubiriwa"    value={summary.pending}     color="#EF9F27" />
          <StatCard label="Imeidhinishwa"  value={summary.approved}    color="#3b82f6" />
          <StatCard label="Imetangazwa"    value={summary.listed}      color="#1D9E75" />
          <StatCard label="Deals Zilizofungwa" value={summary.deal_closed} color="#7c3aed" />
          <StatCard
            label="Kamisheni Inadaiwa"
            value={fmt(summary.commission_due)}
            sub="Baada ya deal kufungwa, bado haijaingia"
            color="#EF9F27"
          />
          <StatCard
            label="Ankara Zimetumwa"
            value={fmt(summary.commission_invoiced)}
            sub="Inasubiri malipo"
            color="#3b82f6"
          />
          <StatCard
            label="Kamisheni Iliyoingia"
            value={fmt(summary.commission_received)}
            sub="Imepokelewa na NF"
            color="#1D9E75"
          />
        </div>
      )}

      {/* ── Filters + Search ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#999992' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta kwa jina, shirika, eneo..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            style={{ borderColor: '#e5e5e0', background: 'white', color: '#1a1a18' }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {['', 'pending', 'approved', 'listed', 'deal_closed', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="flex-shrink-0 text-xs px-3 py-2 rounded-xl border font-medium transition"
              style={{
                background:   filter === s ? '#1a1a18'  : 'white',
                color:        filter === s ? 'white'    : '#666660',
                borderColor:  filter === s ? '#1a1a18'  : '#e5e5e0',
              }}
            >
              {s === '' ? 'Yote' : STATUS_CFG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Request table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#e5e5e0' }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border" style={{ borderColor: '#e5e5e0' }}>
          <i className="ti ti-building-store text-5xl" style={{ color: '#e5e5e0' }} />
          <p className="text-sm font-semibold mt-3" style={{ color: '#1a1a18' }}>Hakuna maombi</p>
          <p className="text-xs mt-1" style={{ color: '#999992' }}>Mashirika hayajawasilisha maombi bado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const sc = STATUS_CFG[req.status]
            const cc = COMMISSION_CFG[req.commission_status]
            return (
              <div
                key={req.id}
                onClick={() => openDetail(req)}
                className="bg-white rounded-2xl border cursor-pointer hover:shadow-sm transition-shadow"
                style={{ borderColor: '#e5e5e0' }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#f4f4f0' }}>
                      {req.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={req.images[0]} alt={req.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="ti ti-building text-2xl" style={{ color: '#e5e5e0' }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: '#1a1a18' }}>{req.title}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#999992' }}>
                            {req.org?.name ?? '—'} · {req.district}, {req.region}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.pill}`}>
                          <i className={`ti ti-${sc.icon} mr-0.5`} />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#1D9E75' }}>
                          {fmt(req.price_monthly)}/mwezi
                        </span>
                        <span className="text-xs" style={{ color: '#999992' }}>
                          Kamisheni: {fmt(req.commission_amount)}
                        </span>
                        <span className={`text-xs font-medium ${cc.color}`}>
                          {cc.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: '#f4f4f0' }}>
                    <div className="flex items-center gap-2">
                      <i className="ti ti-phone text-xs" style={{ color: '#999992' }} />
                      <span className="text-xs font-medium" style={{ color: '#666660' }}>
                        {req.org_contact_phone}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: '#999992' }}>
                      {new Date(req.created_at).toLocaleDateString('sw-TZ')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail drawer ──────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => { setDetail(null); setShowRejectBox(false); setActionError(null) }}
          />

          {/* Panel */}
          <div
            className="relative w-full lg:w-[480px] h-[90vh] lg:h-full overflow-y-auto shadow-2xl flex flex-col"
            style={{ background: 'white', borderLeft: '1px solid #e5e5e0' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#e5e5e0' }}>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#1a1a18' }}>{detail.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#999992' }}>{detail.org?.name ?? '—'}</p>
              </div>
              <button
                onClick={() => { setDetail(null); setShowRejectBox(false); setActionError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0"
              >
                <i className="ti ti-x text-sm" style={{ color: '#666660' }} />
              </button>
            </div>

            {detailLoad && (
              <div className="p-5">
                <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#f4f4f0' }} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status + quick info */}
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${STATUS_CFG[detail.status]?.pill}`}>
                  <i className={`ti ti-${STATUS_CFG[detail.status]?.icon} mr-1`} />
                  {STATUS_CFG[detail.status]?.label}
                </span>
                <span className={`text-xs font-medium ${COMMISSION_CFG[detail.commission_status]?.color}`}>
                  Kamisheni: {COMMISSION_CFG[detail.commission_status]?.label}
                </span>
              </div>

              {/* Property details */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#999992' }}>Mali</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span style={{ color: '#999992' }}>Aina</span>
                  <span className="font-medium" style={{ color: '#1a1a18' }}>{detail.listing_type}</span>
                  <span style={{ color: '#999992' }}>Bei/Mwezi</span>
                  <span className="font-bold" style={{ color: '#1D9E75' }}>{fmt(detail.price_monthly)}</span>
                  <span style={{ color: '#999992' }}>Amana</span>
                  <span style={{ color: '#1a1a18' }}>Miezi {detail.deposit_months}</span>
                  <span style={{ color: '#999992' }}>Eneo</span>
                  <span style={{ color: '#1a1a18' }}>{[detail.mtaa, detail.ward, detail.district, detail.region].filter(Boolean).join(', ')}</span>
                  <span style={{ color: '#999992' }}>Kamisheni</span>
                  <span className="font-bold" style={{ color: '#1a1a18' }}>{fmt(detail.commission_amount)}</span>
                </div>
              </section>

              {/* Org + contact */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#999992' }}>Shirika</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span style={{ color: '#999992' }}>Shirika</span>
                  <span className="font-medium" style={{ color: '#1a1a18' }}>{detail.org?.name ?? '—'}</span>
                  <span style={{ color: '#999992' }}>Wasiliani</span>
                  <span style={{ color: '#1a1a18' }}>{detail.org_contact_name ?? '—'}</span>
                  <span style={{ color: '#999992' }}>Simu/WA</span>
                  <a
                    href={`https://wa.me/${detail.org_contact_phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={{ color: '#1D9E75' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {detail.org_contact_phone}
                  </a>
                  <span style={{ color: '#999992' }}>Aliyewasilisha</span>
                  <span style={{ color: '#1a1a18' }}>
                    {detail.submitter?.full_name ?? detail.submitter?.phone ?? '—'}
                  </span>
                </div>
              </section>

              {/* Listing link (after posting) */}
              {detail.listing && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#999992' }}>Tangazo la Umma</p>
                  <a
                    href={`/listing/${detail.listing.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                    style={{ color: '#1D9E75' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <i className="ti ti-external-link" />
                    {detail.listing.title}
                  </a>
                  <p className="text-xs mt-1" style={{ color: '#999992' }}>
                    Imewekwa na: {detail.poster?.full_name ?? '—'} · {detail.posted_at ? new Date(detail.posted_at).toLocaleDateString('sw-TZ') : '—'}
                  </p>
                </section>
              )}

              {/* Leads (contact unlocks) */}
              {leads.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#999992' }}>
                    Leads ({leads.length} walioona nambari)
                  </p>
                  <div className="space-y-2">
                    {leads.map(lead => (
                      <div key={lead.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#f4f4f0' }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#1a1a18' }}>
                            {lead.tenant?.full_name ?? 'Mtumiaji'}
                          </p>
                          <p className="text-xs" style={{ color: '#999992' }}>
                            {lead.tenant?.phone} · {new Date(lead.created_at).toLocaleDateString('sw-TZ')}
                          </p>
                        </div>
                        {lead.amount_paid && (
                          <span className="text-xs font-medium" style={{ color: '#1D9E75' }}>
                            {fmt(lead.amount_paid)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Rejection reason */}
              {detail.status === 'rejected' && detail.rejection_reason && (
                <div className="rounded-xl p-3 bg-red-50">
                  <p className="text-xs font-semibold text-red-700 mb-1">Sababu ya Kukataliwa</p>
                  <p className="text-sm text-red-600">{detail.rejection_reason}</p>
                </div>
              )}

              {actionError && (
                <div className="rounded-xl p-3 bg-red-50 text-sm text-red-700">
                  <i className="ti ti-alert-circle mr-1" />
                  {actionError}
                </div>
              )}
            </div>

            {/* ── Action buttons ─────────────────────────────────────────── */}
            <div className="flex-shrink-0 border-t p-4 space-y-2" style={{ borderColor: '#e5e5e0' }}>

              {/* Approve */}
              {detail.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRejectBox(true); setActionError(null) }}
                    disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition"
                    style={{ borderColor: '#e5e5e0', color: '#666660' }}
                  >
                    Kataa
                  </button>
                  <button
                    onClick={() => doAction(detail.id, { action: 'approve' })}
                    disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                    style={{ background: '#1D9E75' }}
                  >
                    {acting ? 'Inaendesha...' : 'Idhinisha ✓'}
                  </button>
                </div>
              )}

              {/* Reject box */}
              {showRejectBox && (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Sababu ya kukataliwa (hiari)..."
                    className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRejectBox(false)}
                      className="flex-1 py-2 border rounded-xl text-sm font-medium"
                      style={{ borderColor: '#e5e5e0', color: '#666660' }}>
                      Ghairi
                    </button>
                    <button
                      onClick={() => { doAction(detail.id, { action: 'reject', rejection_reason: rejectReason }); setShowRejectBox(false) }}
                      disabled={acting}
                      className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                    >
                      Kataa
                    </button>
                  </div>
                </div>
              )}

              {/* Post listing — broker picker */}
              {detail.status === 'approved' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#666660' }}>
                      Chagua Broker *
                    </label>
                    <select
                      value={selectedBroker}
                      onChange={e => setSelectedBroker(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 bg-white"
                      style={{ borderColor: '#e5e5e0' }}
                    >
                      <option value="">— Broker yoyote wa kwanza —</option>
                      {brokers.map(b => (
                        <option key={b.user_id} value={b.user_id}>
                          {b.broker_user?.full_name ?? b.broker_user?.email ?? b.user_id}
                          {b.broker_whatsapp ? ` (${b.broker_whatsapp})` : ''}
                        </option>
                      ))}
                    </select>
                    {brokers.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        <i className="ti ti-alert-triangle mr-1" />
                        Hakuna brokers. Unda broker kwenye tab ya &quot;Brokers&quot; kwanza.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => doAction(detail.id, { action: 'post', broker_id: selectedBroker || undefined })}
                    disabled={acting}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: '#1D9E75' }}
                  >
                    {acting ? (
                      <><i className="ti ti-loader-2 animate-spin" /> Inaweka...</>
                    ) : (
                      <><i className="ti ti-speakerphone" /> Tangaza Kupitia NyumbaFasta</>
                    )}
                  </button>
                </div>
              )}

              {/* Close deal */}
              {detail.status === 'listed' && (
                <button
                  onClick={() => doAction(detail.id, { action: 'close_deal' })}
                  disabled={acting}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                  style={{ background: '#7c3aed' }}
                >
                  {acting ? 'Inafunga...' : '🤝 Funga Deal — Mpangaji Amepatikana'}
                </button>
              )}

              {/* Commission invoiced */}
              {detail.status === 'deal_closed' && detail.commission_status === 'pending' && (
                <div className="space-y-2">
                  <input
                    value={commNotes}
                    onChange={e => setCommNotes(e.target.value)}
                    placeholder="Maelezo ya ankara (hiari)..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    style={{ borderColor: '#e5e5e0' }}
                  />
                  <button
                    onClick={() => doAction(detail.id, { action: 'commission_invoiced', notes: commNotes })}
                    disabled={acting}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                    style={{ background: '#3b82f6' }}
                  >
                    {acting ? 'Inasasisha...' : '📄 Tuma Ankara ya Kamisheni'}
                  </button>
                </div>
              )}

              {/* Commission received */}
              {detail.status === 'deal_closed' && detail.commission_status === 'invoiced' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={commAmount}
                      onChange={e => setCommAmount(e.target.value)}
                      placeholder={`Kiasi (def: ${fmt(detail.commission_amount)})`}
                      className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                      style={{ borderColor: '#e5e5e0' }}
                    />
                    <input
                      value={commNotes}
                      onChange={e => setCommNotes(e.target.value)}
                      placeholder="Maelezo..."
                      className="flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                      style={{ borderColor: '#e5e5e0' }}
                    />
                  </div>
                  <button
                    onClick={() => doAction(detail.id, {
                      action:  'commission_received',
                      amount:  commAmount ? Number(commAmount) : null,
                      notes:   commNotes,
                    })}
                    disabled={acting}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                    style={{ background: '#1D9E75' }}
                  >
                    {acting ? 'Inasasisha...' : '✅ Thibitisha Kamisheni Imepokelewa'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
