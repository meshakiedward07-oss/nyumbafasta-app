'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CONV_TYPE_LABELS, CONV_TYPE_ICONS } from '@/lib/types/property'
import type { Conversation, ConvType } from '@/lib/types/property'

const FILTERS: { value: ConvType | 'all'; label: string }[] = [
  { value: 'all',             label: 'Yote'        },
  { value: 'lease',           label: 'Upangaji'    },
  { value: 'service_request', label: 'Huduma'      },
  { value: 'maintenance',     label: 'Matengenezo' },
  { value: 'general',         label: 'Kawaida'     },
]

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Sasa hivi'
  if (mins < 60)  return `Dakika ${mins}`
  if (hours < 24) return `Saa ${hours}`
  return `Siku ${days}`
}

export default function MazungumzoPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [orgId,         setOrgId]         = useState<string | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<ConvType | 'all'>('all')
  const [search,        setSearch]        = useState('')
  const [showNew,       setShowNew]       = useState(false)
  const [newPhone,      setNewPhone]      = useState('')
  const [newMsg,        setNewMsg]        = useState('')
  const [newTitle,      setNewTitle]      = useState('')
  const [creating,      setCreating]      = useState(false)
  const [createError,   setCreateError]   = useState<string | null>(null)
  // useRef avoids stale closure in the poll interval (orgId state is null at setup time)
  const orgIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Get org + user info
        const [orgRes, meRes] = await Promise.all([
          fetch('/api/v1/organizations'),
          fetch('/api/v1/auth/me'),
        ])
        const orgData = await orgRes.json()
        const meData  = await meRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const id = primary.organization.id
        orgIdRef.current = id
        setOrgId(id)
        setUserId(meData.user?.id ?? null)

        const cRes  = await fetch(`/api/v1/conversations?org_id=${id}`)
        const cData = await cRes.json()
        setConversations(cData.conversations ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
    // Poll every 20s for new messages — uses ref so the interval always has current orgId
    const t = setInterval(() => {
      if (!orgIdRef.current) return
      fetch(`/api/v1/conversations?org_id=${orgIdRef.current}`)
        .then(r => r.json())
        .then(d => setConversations(d.conversations ?? []))
        .catch(() => {})
    }, 20_000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleNewConversation() {
    if (!newPhone.trim() || !newMsg.trim() || !orgId) {
      setCreateError('Jaza sehemu zote'); return
    }
    setCreating(true); setCreateError(null)
    try {
      // Look up user by phone
      const lookupRes  = await fetch(`/api/v1/users/search?phone=${encodeURIComponent(newPhone.trim())}`)
      const lookupData = await lookupRes.json()
      if (!lookupData.user) {
        setCreateError('Mtumiaji hajapatikana kwa nambari hiyo ya simu.'); setCreating(false); return
      }
      const res  = await fetch('/api/v1/conversations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           newTitle.trim() || null,
          conv_type:       'general',
          org_id:          orgId,
          participant_ids: [lookupData.user.id],
          first_message:   newMsg.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Kuna tatizo'); return }
      setShowNew(false); setNewPhone(''); setNewMsg(''); setNewTitle('')
      router.push(`/property/mazungumzo/${data.conversation.id}`)
    } catch {
      setCreateError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setCreating(false) }
  }

  const filtered = conversations.filter(c => {
    const matchType   = filter === 'all' || c.conv_type === filter
    const participants = (c.participants as unknown as Array<{ user: { full_name: string | null } | null }>) ?? []
    const names       = participants.map(p => p.user?.full_name?.toLowerCase() ?? '').join(' ')
    const matchSearch = !search.trim() || names.includes(search.toLowerCase()) ||
                        (c.title ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mazungumzo</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-red-500 font-medium">{totalUnread} ujumbe mpya</p>
            )}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-pencil" aria-hidden="true" />
            <span className="hidden sm:inline">Ujumbe Mpya</span>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tafuta mazungumzo..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2"
        />

        {/* Type filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* New conversation form */}
      {showNew && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Ujumbe Mpya</h3>
            <button onClick={() => { setShowNew(false); setCreateError(null) }} className="text-gray-400 hover:text-gray-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Kichwa cha mazungumzo (hiari)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <div className="flex gap-2">
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="Nambari ya simu (+255...)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} rows={2}
              placeholder="Andika ujumbe wako wa kwanza..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNew(false); setCreateError(null) }}
                className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                Ghairi
              </button>
              <button onClick={handleNewConversation} disabled={creating}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                {creating ? 'Inatuma...' : 'Tuma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <i className="ti ti-message-circle text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">
              {conversations.length === 0 ? 'Hakuna mazungumzo bado' : 'Hakuna matokeo'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {conversations.length === 0
                ? 'Mazungumzo yataanzishwa kiotomatiki unapoongeza mpangaji.'
                : 'Badilisha vichujio.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(conv => {
              const participants = (conv.participants as unknown as Array<{
                user_id: string
                user: { id: string; full_name: string | null; avatar_url: string | null } | null
              }>) ?? []

              const others = participants.filter(p => p.user_id !== userId)
              const otherNames = others.map(p => p.user?.full_name ?? 'Mtumiaji').join(', ')
              const firstOther = others[0]?.user
              const lastMsg    = conv.last_message as unknown as { body: string; sender_id: string } | null
              const unread     = (conv.unread_count ?? 0) > 0
              const icon       = CONV_TYPE_ICONS[conv.conv_type] ?? 'message'

              return (
                <Link key={conv.id} href={`/property/mazungumzo/${conv.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition cursor-pointer ${unread ? 'bg-primary-50/30' : ''}`}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center">
                        {firstOther?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={firstOther.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <span className="text-primary-600 font-bold text-sm">
                            {firstOther?.full_name?.charAt(0)?.toUpperCase() ?? <i className={`ti ti-${icon}`} />}
                          </span>
                        )}
                      </div>
                      {unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className={`text-sm truncate ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                          {conv.title ?? otherNames ?? CONV_TYPE_LABELS[conv.conv_type]}
                        </p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs truncate ${unread ? 'text-gray-700' : 'text-gray-400'}`}>
                          {lastMsg?.body ?? 'Bonyeza kuanza mazungumzo'}
                        </p>
                        {(conv.unread_count ?? 0) > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-primary-500 text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
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
