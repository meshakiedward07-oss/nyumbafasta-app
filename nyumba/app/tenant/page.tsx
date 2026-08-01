'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Payment {
  id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  proof_url: string | null; proof_note: string | null
  proof_uploaded_at: string | null; verified_at: string | null
  invoice_sent_at: string | null
}

interface Banking {
  bank_name: string; account_name: string; account_number: string
  branch: string | null; mobile_money_number: string | null
  mobile_money_provider: string | null; additional_instructions: string | null
}

interface LeaseUnit    { id: string; unit_number: string; unit_type: string }
interface LeaseListing { id: string; title: string; district: string; region: string; images: string[] | null }

interface ConvParticipant {
  user_id: string; role: string; last_read_at: string | null
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface Conversation {
  id: string; title: string | null; conv_type: string; org_id: string | null
  last_message_at: string | null; created_at: string
  participants: ConvParticipant[]
  last_message: { body: string; sender_id: string; created_at: string } | null
  unread_count: number
}

interface Message {
  id: string; conversation_id: string; sender_id: string; body: string
  message_type: string; created_at: string
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface NotificationItem {
  id: string; title: string; body: string; type: string
  is_read: boolean; ref_id: string | null; created_at: string
}

interface EnrichedLease {
  lease: {
    id: string; org_id: string; monthly_rent: number; deposit_amount: number | null
    deposit_paid: boolean; start_date: string; end_date: string | null; status: string
    unit: LeaseUnit | null; listing: LeaseListing | null
  }
  payments: Payment[]
  banking:   Banking | null
  org_name:  string | null
  org_phone: string | null
  org_email: string | null
  org_id:    string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAINT_STATUS: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Wazi',            cls: 'bg-amber-50 text-amber-700'  },
  in_progress: { label: 'Inaendelea',      cls: 'bg-blue-50 text-blue-700'    },
  resolved:    { label: 'Imeshughulikiwa', cls: 'bg-green-50 text-green-700'  },
  closed:      { label: 'Imefungwa',       cls: 'bg-gray-100 text-gray-500'   },
}

const MAINT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'plumbing',   label: 'Mabomba / Maji'  },
  { value: 'electrical', label: 'Umeme'            },
  { value: 'structural', label: 'Jengo / Miundo'   },
  { value: 'cleaning',   label: 'Usafi'            },
  { value: 'security',   label: 'Usalama'          },
  { value: 'appliance',  label: 'Vifaa / Majiko'   },
  { value: 'other',      label: 'Nyingine'         },
]

const PAYMENT_STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  pending:        { label: 'Inasubiri Malipo',   cls: 'bg-amber-50 text-amber-700',   icon: 'clock'        },
  partial:        { label: 'Ilipwa Kidogo',       cls: 'bg-orange-50 text-orange-700', icon: 'circle-half'  },
  proof_uploaded: { label: 'Ushahidi Umepakiwa', cls: 'bg-blue-50 text-blue-700',     icon: 'upload'       },
  paid:           { label: 'Imelipwa',            cls: 'bg-green-50 text-green-700',   icon: 'circle-check' },
  void:           { label: 'Imebatilishwa',       cls: 'bg-gray-100 text-gray-400',    icon: 'ban'          },
}

const NOTIF_ICONS: Record<string, string> = {
  lease_created:       'home',
  payment_verified:    'shield-check',
  maintenance_update:  'tool',
  maintenance_request: 'tool',
  general:             'bell',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function timeFmt(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH  = Math.floor(diffMs / 3_600_000)
  if (diffH < 1)  return 'Sasa hivi'
  if (diffH < 24) return `Saa ${diffH} iliyopita`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7)  return `Siku ${diffD} iliyopita`
  return d.toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function buildWhatsApp(phone: string) {
  const clean = phone.replace(/\D/g, '')
  const intl  = clean.startsWith('0') ? `255${clean.slice(1)}` : clean
  return `https://wa.me/${intl}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <p className="text-xs text-gray-400 flex-shrink-0">{label}</p>
      <p className={`text-sm text-right ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}

function BankingCard({ banking }: { banking: Banking }) {
  const [copied, setCopied] = useState(false)
  function copyAccount() {
    navigator.clipboard.writeText(banking.account_number).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <i className="ti ti-building-bank" aria-hidden="true" /> Lipa Kodi Kwenye Akaunti Hii
      </p>
      <div className="space-y-2">
        <BRow label="Benki"           value={banking.bank_name}    />
        <BRow label="Jina la Akaunti" value={banking.account_name} />
        <div className="flex justify-between items-center">
          <BRow label="Nambari ya Akaunti" value={banking.account_number} bold />
          <button onClick={copyAccount}
            className="ml-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <i className={`ti ti-${copied ? 'check' : 'copy'}`} aria-hidden="true" />
            {copied ? 'Imenakiliwa' : 'Nakili'}
          </button>
        </div>
        {banking.branch && <BRow label="Tawi" value={banking.branch} />}
        {banking.mobile_money_number && (
          <BRow
            label={banking.mobile_money_provider ?? 'Simu'}
            value={banking.mobile_money_number}
            bold
          />
        )}
        {banking.additional_instructions && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-0.5">Maelezo Zaidi</p>
            <p className="text-sm text-gray-600">{banking.additional_instructions}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentCard({ p }: { p: Payment; leaseId: string }) {
  const isOverdue = ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < new Date()
  const daysLeft  = daysUntil(p.due_date)
  const s = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.pending

  return (
    <div className={`rounded-2xl border p-4 ${
      isOverdue                     ? 'border-red-100 bg-red-50/40' :
      p.status === 'paid'           ? 'border-green-100 bg-green-50/20' :
      p.status === 'proof_uploaded' ? 'border-blue-100 bg-blue-50/20' :
      'border-gray-100 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Kodi ya Mwezi</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            TZS {p.amount_due.toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
            <span>Inastahili: <strong className={isOverdue ? 'text-red-600' : ''}>{dateFmt(p.due_date)}</strong></span>
            {isOverdue && (
              <span className="text-red-500 font-medium">(siku {Math.abs(daysLeft)} zimepita)</span>
            )}
            {!isOverdue && daysLeft >= 0 && daysLeft <= 7 && p.status === 'pending' && (
              <span className="text-amber-500 font-medium">(siku {daysLeft} zimebaki)</span>
            )}
          </div>
          {p.paid_date && (
            <p className="text-xs text-green-600 mt-1">
              <i className="ti ti-circle-check" aria-hidden="true" /> Ilipwa: {dateFmt(p.paid_date)}
            </p>
          )}
          {p.verified_at && (
            <p className="text-xs text-green-500 mt-0.5">
              <i className="ti ti-shield-check" aria-hidden="true" /> Imethibitishwa: {dateFmt(p.verified_at)}
            </p>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
          <i className={`ti ti-${s.icon}`} aria-hidden="true" />
          {s.label}
        </span>
      </div>

      {p.status === 'proof_uploaded' && (
        <div className="mt-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
          <p className="font-medium mb-0.5">
            <i className="ti ti-upload mr-1" aria-hidden="true" />Ushahidi umepakiwa
          </p>
          <p className="text-blue-500">Mmiliki ataona na atathibitisha hivi karibuni.</p>
          {p.proof_url && (
            <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
               className="mt-1 block text-blue-600 underline truncate">{p.proof_url}</a>
          )}
        </div>
      )}

      {['pending', 'partial'].includes(p.status) && (
        <Link href={`/rent/proof/${p.id}`}
          className="mt-3 flex items-center justify-center gap-2 w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
          <i className="ti ti-upload" aria-hidden="true" />
          Pakia Ushahidi wa Malipo
        </Link>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TenantPage() {
  // Lease data
  const [leases,        setLeases]        = useState<EnrichedLease[]>([])
  const [loading,       setLoading]       = useState(true)
  const [authErr,       setAuthErr]       = useState(false)
  const [activeLeaseIdx, setActiveLeaseIdx] = useState(0)
  const [activeTab,     setActiveTab]     = useState<'malipo' | 'historia' | 'mazungumzo' | 'matengenezo'>('malipo')

  // Maintenance
  const [requests,      setRequests]      = useState<{ id: string; title: string; description: string | null; category: string; priority: string; status: string; created_at: string; resolved_at: string | null; images: string[] | null; notes: string | null; unit: { id: string; unit_number: string } | null; assignee: { id: string; full_name: string | null; avatar_url: string | null } | null }[]>([])
  const [maintLoaded,   setMaintLoaded]   = useState(false)
  const [showMaintForm, setShowMaintForm] = useState(false)
  const [maintForm,     setMaintForm]     = useState({ title: '', description: '', category: 'other', priority: 'medium' })
  const [maintSubmitting, setMaintSubmitting] = useState(false)
  const [maintErr,      setMaintErr]      = useState<string | null>(null)

  // Notifications
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifs,         setNotifs]         = useState<NotificationItem[]>([])
  const [notifsLoaded,   setNotifsLoaded]   = useState(false)
  const [unreadNotifs,   setUnreadNotifs]   = useState(0)

  // Conversations
  const [convs,       setConvs]       = useState<Conversation[]>([])
  const [convsLoaded, setConvsLoaded] = useState(false)
  const [activeConv,  setActiveConv]  = useState<Conversation | null>(null)
  const [messages,    setMessages]    = useState<Message[]>([])
  const [newMsg,      setNewMsg]      = useState('')
  const [sendingMsg,  setSendingMsg]  = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/my-lease')
        if (res.status === 401) { setAuthErr(true); return }
        const data = await res.json()
        setLeases(data.leases ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }

      // Fetch unread notification count in background
      fetch('/api/v1/notifications?count=true')
        .then(r => r.json())
        .then(d => setUnreadNotifs(d.unread_count ?? 0))
        .catch(() => {})

      // Get current user id for message display
      fetch('/api/v1/auth/me')
        .then(r => r.json())
        .then(d => { if (d.user?.id) setCurrentUserId(d.user.id) })
        .catch(() => {})
    }
    load()
  }, [])

  // ── Notification handlers ──────────────────────────────────────────────────

  async function openNotifications() {
    setShowNotifPanel(true)
    if (!notifsLoaded) {
      const res  = await fetch('/api/v1/notifications').catch(() => null)
      const data = res ? await res.json().catch(() => ({})) : {}
      setNotifs(data.notifications ?? [])
      setNotifsLoaded(true)
    }
    if (unreadNotifs > 0) {
      fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => {})
      setUnreadNotifs(0)
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  // ── Conversation handlers ──────────────────────────────────────────────────

  async function loadConversations() {
    if (convsLoaded) return
    try {
      const res  = await fetch('/api/v1/conversations')
      const data = await res.json()
      setConvs(data.conversations ?? [])
    } catch { /* silent */ }
    finally { setConvsLoaded(true) }
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv)
    setMessages([])
    try {
      const res  = await fetch(`/api/v1/conversations/${conv.id}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
      // mark as read
      fetch(`/api/v1/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {})
      setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    } catch { /* silent */ }
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
  }

  async function handleSendMsg(convId: string) {
    const body = newMsg.trim()
    if (!body || sendingMsg) return
    setSendingMsg(true)
    setNewMsg('')
    try {
      const res  = await fetch(`/api/v1/conversations/${convId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: body }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [...prev, data.message])
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch { /* silent */ }
    finally { setSendingMsg(false) }
  }

  // ── Maintenance handlers ───────────────────────────────────────────────────

  async function loadMaintenance() {
    if (maintLoaded) return
    try {
      const res  = await fetch('/api/v1/my-maintenance')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch { /* silent */ }
    finally { setMaintLoaded(true) }
  }

  async function handleMaintSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!maintForm.title.trim()) { setMaintErr('Kichwa cha tatizo kinahitajika.'); return }
    setMaintSubmitting(true); setMaintErr(null)
    try {
      const res  = await fetch('/api/v1/my-maintenance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(maintForm),
      })
      const data = await res.json()
      if (!res.ok) { setMaintErr(data.error ?? 'Imeshindwa kutuma.'); return }
      setRequests(prev => [data.request, ...prev])
      setMaintForm({ title: '', description: '', category: 'other', priority: 'medium' })
      setShowMaintForm(false)
    } catch { setMaintErr('Imeshindwa kutuma. Angalia muunganiko wako.') }
    finally { setMaintSubmitting(false) }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 max-w-xl mx-auto">
        <div className="space-y-3 pt-8">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      </div>
    )
  }

  if (authErr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-lock text-3xl text-primary-400" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">Ingia kwanza</h2>
          <p className="text-sm text-gray-500 mb-6">
            Unahitaji kuingia katika akaunti yako ya mpangaji ili kuona malipo yako.
          </p>
          <Link href="/login?redirect=/tenant">
            <button className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition">
              Ingia Sasa
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (leases.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-home-off text-3xl text-amber-400" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">Huna mkataba bado</h2>
          <p className="text-sm text-gray-500 mb-4">
            Akaunti yako bado haijaunganishwa na mkataba wowote wa upangaji.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Mwambie mmiliki wako nambari yako ya simu ili akusajilishe kwenye mfumo huu.
          </p>
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 mb-3">Unatafuta nyumba ya kupanga?</p>
            <Link href="/"
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
            >
              <i className="ti ti-home-search" aria-hidden="true" />
              Tafuta Nyumba kwenye Soko
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const current  = leases[activeLeaseIdx]
  const { lease, payments, banking, org_name, org_phone, org_email } = current

  const unit    = lease.unit    as unknown as LeaseUnit | null
  const listing = lease.listing as unknown as LeaseListing | null

  const pendingPayments = payments.filter(p => ['pending', 'partial', 'proof_uploaded'].includes(p.status))
  const pastPayments    = payments.filter(p => ['paid', 'void'].includes(p.status))
  const overdueCount    = pendingPayments.filter(p =>
    ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < new Date()
  ).length

  const totalUnreadConvs = convs.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Notification panel overlay ────────────────────────────────────── */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowNotifPanel(false)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <h2 className="font-bold text-gray-900">Arifa</h2>
              <button onClick={() => setShowNotifPanel(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <i className="ti ti-x text-sm text-gray-600" aria-hidden="true" />
              </button>
            </div>
            {!notifsLoaded ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : notifs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <i className="ti ti-bell-off text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna arifa bado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifs.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3.5 ${!n.is_read ? 'bg-primary-50/40' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${!n.is_read ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <i className={`ti ti-${NOTIF_ICONS[n.type] ?? 'bell'} text-sm ${!n.is_read ? 'text-primary-600' : 'text-gray-400'}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeFmt(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-primary-500 text-white px-4 pt-10 pb-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-primary-200 text-xs mb-1">{org_name ?? 'NyumbaFasta'}</p>
              <h1 className="text-xl font-bold">Malipo Yangu ya Kodi</h1>
              <div className="flex items-center gap-2 mt-1.5 text-primary-100 text-sm flex-wrap">
                {unit && (
                  <span className="flex items-center gap-1">
                    <i className="ti ti-door text-xs" aria-hidden="true" /> {unit.unit_number}
                  </span>
                )}
                {listing && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[180px]">{listing.title}</span>
                  </>
                )}
              </div>
            </div>
            {/* Notification bell */}
            <button
              onClick={openNotifications}
              className="relative ml-3 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition flex items-center justify-center flex-shrink-0"
              aria-label="Arifa"
            >
              <i className="ti ti-bell text-white text-lg" aria-hidden="true" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Multiple leases switcher */}
      {leases.length > 1 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <div className="max-w-xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {leases.map((l, i) => {
              const u = l.lease.unit as unknown as LeaseUnit | null
              return (
                <button key={l.lease.id} onClick={() => setActiveLeaseIdx(i)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    activeLeaseIdx === i ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {u?.unit_number ?? `Mkataba ${i + 1}`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto p-4 space-y-4">

        {/* ── Lease summary card ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Kodi ya Mwezi</p>
              <p className="font-bold text-primary-600 text-lg tabular-nums">
                TZS {lease.monthly_rent.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Hali ya Mkataba</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                lease.status === 'active'  ? 'bg-green-50 text-green-700' :
                lease.status === 'expired' ? 'bg-amber-50 text-amber-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                <i className="ti ti-circle-filled text-[6px]" aria-hidden="true" />
                {lease.status === 'active' ? 'Inaendelea' : lease.status === 'expired' ? 'Imekwisha' : lease.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ilianza</p>
              <p className="font-medium text-gray-700">{dateFmt(lease.start_date)}</p>
            </div>
            {lease.end_date && (
              <div>
                <p className="text-xs text-gray-400">Muda wa Mwisho</p>
                <p className="font-medium text-gray-700">{dateFmt(lease.end_date)}</p>
              </div>
            )}
            {lease.deposit_amount && (
              <div>
                <p className="text-xs text-gray-400">Amana</p>
                <p className={`font-medium text-sm ${lease.deposit_paid ? 'text-green-600' : 'text-amber-600'}`}>
                  TZS {lease.deposit_amount.toLocaleString()}
                  {' '}
                  <span className="text-xs">({lease.deposit_paid ? '✓ Imelipwa' : '✗ Haijalipiwa'})</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Org contact card (Feature 1) ───────────────────────────────── */}
        {(org_phone || org_email) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <i className="ti ti-building-estate" aria-hidden="true" /> Mawasiliano na {org_name ?? 'Mmiliki'}
            </p>
            <div className="flex flex-wrap gap-3">
              {org_phone && (
                <>
                  <a
                    href={`tel:${org_phone}`}
                    className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition rounded-xl px-3 py-2 text-sm text-gray-700 font-medium"
                  >
                    <i className="ti ti-phone text-primary-500" aria-hidden="true" />
                    {org_phone}
                  </a>
                  <a
                    href={buildWhatsApp(org_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-50 hover:bg-green-100 transition rounded-xl px-3 py-2 text-sm text-green-700 font-medium"
                  >
                    <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                    WhatsApp
                  </a>
                </>
              )}
              {org_email && (
                <a
                  href={`mailto:${org_email}`}
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 transition rounded-xl px-3 py-2 text-sm text-blue-700 font-medium"
                >
                  <i className="ti ti-mail" aria-hidden="true" />
                  {org_email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Tab switcher ───────────────────────────────────────────────── */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {([
            { key: 'malipo',      label: 'Malipo',       icon: 'cash'     },
            { key: 'historia',    label: 'Historia',     icon: 'history'  },
            { key: 'mazungumzo',  label: 'Mazungumzo',   icon: 'message'  },
            { key: 'matengenezo', label: 'Matengenezo',  icon: 'tool'     },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                if (tab.key === 'mazungumzo') loadConversations()
                if (tab.key === 'matengenezo') loadMaintenance()
              }}
              className={`relative flex-1 py-2 rounded-lg text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <i className={`ti ti-${tab.icon}`} aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.key === 'mazungumzo' && totalUnreadConvs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {totalUnreadConvs}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════ MALIPO TAB ════════════════════════════════ */}
        {activeTab === 'malipo' && (
          <>
            {overdueCount > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <i className="ti ti-alert-triangle text-red-500 text-xl mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-red-700 text-sm">Malipo {overdueCount} Yamechelewa</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Tafadhali lipa na upaki ushahidi haraka ili kuepuka matatizo.
                  </p>
                </div>
              </div>
            )}

            {banking && <BankingCard banking={banking} />}

            {!banking && pendingPayments.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <i className="ti ti-info-circle text-amber-500 text-xl flex-shrink-0" aria-hidden="true" />
                <p className="text-sm text-amber-700">
                  Mmiliki bado hajaweka taarifa za akaunti ya benki. Wasiliana nao moja kwa moja.
                </p>
              </div>
            )}

            {pendingPayments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Malipo Yanayosubiri ({pendingPayments.length})
                </p>
                <div className="space-y-3">
                  {pendingPayments.map(p => <PaymentCard key={p.id} p={p} leaseId={lease.id} />)}
                </div>
              </div>
            )}

            {pastPayments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Historia ya Malipo
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {pastPayments.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        p.status === 'paid' ? 'bg-green-50' : 'bg-gray-100'
                      }`}>
                        <i className={`ti ti-${p.status === 'paid' ? 'circle-check text-green-500' : 'ban text-gray-400'} text-sm`} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">TZS {p.amount_due.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{dateFmt(p.due_date)}</p>
                      </div>
                      <div className="text-right">
                        {p.paid_date && <p className="text-xs text-green-600">{dateFmt(p.paid_date)}</p>}
                        {p.verified_at && (
                          <p className="text-[10px] text-green-400 flex items-center gap-0.5 justify-end">
                            <i className="ti ti-shield-check" aria-hidden="true" /> Imethibitishwa
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingPayments.length === 0 && pastPayments.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <i className="ti ti-calendar-event text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna malipo bado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Malipo ya kodi yataonekana hapa punde tu yatakapotengenezwa na mmiliki wako.
                </p>
              </div>
            )}
          </>
        )}

        {/* ════════════════════ HISTORIA TAB ══════════════════════════════ */}
        {activeTab === 'historia' && (() => {
          type FlatPayment = Payment & { unitLabel: string; orgLabel: string }
          const flat: FlatPayment[] = leases.flatMap(l => {
            const u = l.lease.unit as unknown as LeaseUnit | null
            return l.payments.map(p => ({
              ...p,
              unitLabel: u?.unit_number ?? 'Mkataba',
              orgLabel:  l.org_name ?? 'NyumbaFasta',
            }))
          })
          flat.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())

          if (flat.length === 0) {
            return (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <i className="ti ti-history text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna historia ya malipo</p>
              </div>
            )
          }

          return (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                Historia Yote ya Malipo ({flat.length})
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {flat.map((p, i) => {
                  const s = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.pending
                  const isOverdue = ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < new Date()
                  return (
                    <div key={`${p.id}-${i}`} className={`flex items-start gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''} ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        p.status === 'paid' ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-gray-100'
                      }`}>
                        <i className={`ti ti-${s.icon} text-sm ${
                          p.status === 'paid' ? 'text-green-500' : isOverdue ? 'text-red-400' : 'text-gray-400'
                        }`} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-800 tabular-nums">TZS {p.amount_due.toLocaleString()}</p>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{p.unitLabel}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ankara: {dateFmt(p.due_date)}
                          {p.paid_date && ` · Ilipwa: ${dateFmt(p.paid_date)}`}
                        </p>
                        {p.verified_at && (
                          <p className="text-[10px] text-green-500 mt-0.5 flex items-center gap-0.5">
                            <i className="ti ti-shield-check" aria-hidden="true" /> Imethibitishwa
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                        {p.status === 'paid' && (
                          <a href={`/rent/receipt/${p.id}`} className="text-[10px] text-primary-600 hover:underline flex items-center gap-0.5">
                            <i className="ti ti-receipt text-[10px]" aria-hidden="true" /> Risiti
                          </a>
                        )}
                        {['pending', 'partial'].includes(p.status) && (
                          <a href={`/rent/proof/${p.id}`} className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5">
                            <i className="ti ti-upload text-[10px]" aria-hidden="true" /> Lipa
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ════════════════════ MAZUNGUMZO TAB (Feature 2) ════════════════ */}
        {activeTab === 'mazungumzo' && (
          <div className="space-y-3">
            {activeConv ? (
              /* ── Thread view ── */
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '420px' }}>
                {/* Thread header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <button onClick={() => { setActiveConv(null); setMessages([]) }}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                    <i className="ti ti-arrow-left text-sm text-gray-600" aria-hidden="true" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {activeConv.title ?? org_name ?? 'Mazungumzo'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activeConv.participants.length} washiriki
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '360px' }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="ti ti-message-off text-3xl text-gray-200" aria-hidden="true" />
                      <p className="text-sm text-gray-400 mt-2">Hakuna ujumbe bado</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.sender_id === currentUserId
                      const isSystem = msg.message_type === 'system'
                      if (isSystem) {
                        return (
                          <div key={msg.id} className="text-center">
                            <span className="inline-block bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                              {msg.body}
                            </span>
                          </div>
                        )
                      }
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] ${isMe ? 'order-2' : ''}`}>
                            {!isMe && (
                              <p className="text-[10px] text-gray-400 mb-1 ml-1">
                                {msg.sender?.full_name ?? 'Mmiliki'}
                              </p>
                            )}
                            <div className={`px-3 py-2 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-primary-500 text-white rounded-br-md'
                                : 'bg-gray-100 text-gray-800 rounded-bl-md'
                            }`}>
                              {msg.body}
                            </div>
                            <p className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right' : 'ml-1'}`}>
                              {timeFmt(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Message input */}
                <div className="border-t border-gray-100 p-3 flex gap-2">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg(activeConv.id) } }}
                    placeholder="Andika ujumbe..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <button
                    onClick={() => handleSendMsg(activeConv.id)}
                    disabled={!newMsg.trim() || sendingMsg}
                    className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary-600 transition flex-shrink-0"
                  >
                    {sendingMsg
                      ? <i className="ti ti-loader-2 animate-spin text-sm" aria-hidden="true" />
                      : <i className="ti ti-send text-sm" aria-hidden="true" />
                    }
                  </button>
                </div>
              </div>
            ) : (
              /* ── Conversation list ── */
              <>
                {!convsLoaded ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
                  </div>
                ) : convs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                    <i className="ti ti-message-off text-5xl text-gray-200" aria-hidden="true" />
                    <p className="text-gray-500 font-medium mt-3">Hakuna mazungumzo bado</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Mazungumzo kati yako na mmiliki yataonekana hapa baada ya mkataba kuanzishwa.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {convs.map((conv, i) => {
                      const otherParticipant = conv.participants.find(p => p.user_id !== currentUserId)
                      const displayName = conv.title ?? otherParticipant?.user?.full_name ?? org_name ?? 'Mazungumzo'
                      return (
                        <button
                          key={conv.id}
                          onClick={() => openConversation(conv)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <i className="ti ti-building-estate text-primary-500 text-sm" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {displayName}
                              </p>
                              {conv.last_message_at && (
                                <p className="text-[10px] text-gray-400 flex-shrink-0">{timeFmt(conv.last_message_at)}</p>
                              )}
                            </div>
                            {conv.last_message && (
                              <p className={`text-xs mt-0.5 truncate ${conv.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                                {conv.last_message.sender_id === currentUserId ? 'Wewe: ' : ''}{conv.last_message.body}
                              </p>
                            )}
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="w-5 h-5 bg-primary-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0">
                              {conv.unread_count > 9 ? '9+' : conv.unread_count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════ MATENGENEZO TAB ═══════════════════════════ */}
        {activeTab === 'matengenezo' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowMaintForm(v => !v)}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition"
            >
              <i className={`ti ti-${showMaintForm ? 'x' : 'plus'}`} aria-hidden="true" />
              {showMaintForm ? 'Funga Fomu' : 'Wasilisha Tatizo Jipya'}
            </button>

            {showMaintForm && (
              <form onSubmit={handleMaintSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Maelezo ya Tatizo</p>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Kichwa cha Tatizo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={maintForm.title}
                    onChange={e => setMaintForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="mfano: Bomba linachuruzika bafuni"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Maelezo ya Ziada</label>
                  <textarea
                    value={maintForm.description}
                    onChange={e => setMaintForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Elezea tatizo kwa undani zaidi..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Aina ya Tatizo</label>
                    <select
                      value={maintForm.category}
                      onChange={e => setMaintForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      {MAINT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Haraka</label>
                    <select
                      value={maintForm.priority}
                      onChange={e => setMaintForm(p => ({ ...p, priority: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="urgent">Dharura</option>
                      <option value="high">Juu</option>
                      <option value="medium">Kati</option>
                      <option value="low">Chini</option>
                    </select>
                  </div>
                </div>

                {maintErr && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                    <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />
                    {maintErr}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={maintSubmitting}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-600 transition flex items-center justify-center gap-2"
                >
                  {maintSubmitting
                    ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inatuma...</>
                    : <><i className="ti ti-send" aria-hidden="true" />Tuma Ombi</>
                  }
                </button>
              </form>
            )}

            {!maintLoaded ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <i className="ti ti-tool text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna maombi bado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Kama una tatizo lolote la nyumba, bonyeza kitufe hapo juu.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(r => {
                  const s = MAINT_STATUS[r.status] ?? MAINT_STATUS.open
                  const catLabel = MAINT_CATEGORIES.find(c => c.value === r.category)?.label ?? r.category
                  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-semibold text-gray-900 text-sm flex-1">{r.title}</p>
                        <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <i className="ti ti-tag" aria-hidden="true" />{catLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ti ti-calendar" aria-hidden="true" />
                          {new Date(r.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {r.assignee?.full_name && (
                          <span className="flex items-center gap-1 text-primary-600">
                            <i className="ti ti-user" aria-hidden="true" />
                            {r.assignee.full_name}
                          </span>
                        )}
                        {r.resolved_at && (
                          <span className="flex items-center gap-1 text-green-500">
                            <i className="ti ti-circle-check" aria-hidden="true" />
                            Imeshughulikiwa
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Marketplace access */}
        <div className="pb-6 space-y-3">
          <Link href="/"
            className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            <i className="ti ti-home-search text-primary-500" aria-hidden="true" />
            Tafuta Nyumba Nyingine kwenye Soko
          </Link>
          <p className="text-center text-xs text-gray-400">
            NyumbaFasta · Msaada: <a href="https://wa.me/255665831694" className="underline">WhatsApp</a>
          </p>
        </div>
      </div>
    </div>
  )
}
