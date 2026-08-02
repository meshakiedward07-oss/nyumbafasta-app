'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AttachmentCompose, { type PendingAttachment } from '@/components/messages/AttachmentCompose'
import AttachmentDisplay from '@/components/messages/AttachmentDisplay'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  user_id: string
  role: string
  last_read_at: string | null
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface Conversation {
  id: string
  title: string | null
  conv_type: string
  status: string
  org_id: string | null
  source_role: string | null
  last_message_at: string | null
  created_at: string
  unread_count: number
  last_message_body: string | null
  participants: Participant[]
}

interface Attachment {
  id?: string
  file_url: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  message_type: string
  created_at: string
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
  attachments?: Attachment[]
}

interface Contact {
  id: string
  name: string
  subtitle: string | null
  avatar_url: string | null
  type: string
  user_id?: string
  org_id?: string
  owner_id?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTACT_TABS = [
  { key: 'staff',      label: 'Wafanyakazi' },
  { key: 'dalali',     label: 'Madalali' },
  { key: 'org',        label: 'Mashirika' },
  { key: 'tenant',     label: 'Wapangaji' },
  { key: 'advertiser', label: 'Watangazaji' },
]

const SOURCE_TABS = [
  { key: 'all',        label: 'Wote' },
  { key: 'dalali',     label: 'Madalali' },
  { key: 'advertiser', label: 'Watangazaji' },
  { key: 'org',        label: 'Mashirika' },
]

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin:      { label: 'Admin',      cls: 'bg-purple-100 text-purple-700' },
  staff:      { label: 'Staff',      cls: 'bg-blue-100 text-blue-700' },
  dalali:     { label: 'Dalali',     cls: 'bg-amber-100 text-amber-700' },
  org:        { label: 'Shirika',    cls: 'bg-green-100 text-green-700' },
  org_owner:  { label: 'Mmiliki',   cls: 'bg-teal-100 text-teal-700' },
  tenant:     { label: 'Mpangaji',  cls: 'bg-rose-100 text-rose-700' },
  advertiser: { label: 'Mtangazaji', cls: 'bg-orange-100 text-orange-700' },
}

function roleBadge(type: string) {
  const b = ROLE_BADGE[type]
  if (!b) return null
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${b.cls}`}>{b.label}</span>
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Sasa hivi'
  if (m < 60) return `Dak. ${m}`
  const h = Math.floor(m / 60)
  if (h < 24) return `Saa ${h}`
  return `Siku ${Math.floor(h / 24)}`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ src, name, size = 8 }: { src?: string | null; name: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0`
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name ?? ''} className={`${cls} object-cover`} />
  return <div className={`${cls} bg-primary-100 text-primary-700`}>{initials(name)}</div>
}

function convLabel(conv: Conversation, currentUserId: string): string {
  if (conv.title) return conv.title
  const others = (conv.participants ?? [])
    .filter((p) => p.user_id !== currentUserId)
    .map((p) => p.user?.full_name ?? 'Mtumiaji')
  return others.length ? others.slice(0, 2).join(', ') : 'Mazungumzo'
}

function convTypeTag(conv: Conversation) {
  if (conv.source_role && ROLE_BADGE[conv.source_role]) return roleBadge(conv.source_role)
  if (conv.org_id) return roleBadge('org')
  const firstRole = (conv.participants ?? []).find((p) => p.role !== 'owner')?.role
  if (firstRole && ROLE_BADGE[firstRole]) return roleBadge(firstRole)
  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
}

export default function MessagesPanel({ currentUserId, currentUserName, currentUserAvatar }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  // Mobile: 'list' shows conversation list, 'thread' shows the open conversation
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>('list')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)

  // New conversation
  const [showNewConv, setShowNewConv] = useState(false)
  const [contactTab, setContactTab] = useState('staff')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [pickedContact, setPickedContact] = useState<Contact | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newFirstMsg, setNewFirstMsg] = useState('')
  const [creating, setCreating] = useState(false)

  const [sourceTab, setSourceTab] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const realtimeOk = useRef(false)
  const supabase = createClient()

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/v1/conversations')
    if (!res.ok) return
    const json = await res.json()
    setConversations(json.conversations ?? [])
    setLoading(false)
  }, [])

  const loadThread = useCallback(async (convId: string) => {
    setLoadingThread(true)
    const res = await fetch(`/api/v1/conversations/${convId}`)
    if (!res.ok) { setLoadingThread(false); return }
    const json = await res.json()
    setMessages(json.messages ?? [])
    setLoadingThread(false)
    await fetch(`/api/v1/conversations/${convId}/read`, { method: 'POST' })
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c))
  }, [])

  const loadContacts = useCallback(async (type: string, q = '') => {
    setContactsLoading(true)
    const params = new URLSearchParams({ type })
    if (q) params.set('q', q)
    const res = await fetch(`/api/v1/conversations/contacts?${params}`)
    if (res.ok) { const json = await res.json(); setContacts(json.contacts ?? []) }
    setContactsLoading(false)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    if (!selected) return
    realtimeOk.current = false
    const channel = supabase
      .channel(`admin-messages-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, () => { loadThread(selected.id); loadConversations() })
      .subscribe(status => { if (status === 'SUBSCRIBED') realtimeOk.current = true })
    return () => { realtimeOk.current = false; supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => {
      if (!realtimeOk.current) { loadThread(selected.id); loadConversations() }
    }, 30000)
    return () => clearInterval(t)
  }, [selected, loadThread, loadConversations])

  useEffect(() => {
    if (selected) loadThread(selected.id)
  }, [selected, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showNewConv) { setPickedContact(null); loadContacts(contactTab) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewConv])

  useEffect(() => {
    if (showNewConv) { setContacts([]); loadContacts(contactTab, contactSearch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactTab, contactSearch])

  // Auto-grow textarea
  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function openConversation(conv: Conversation) {
    setSelected(conv)
    setMobilePane('thread')
  }

  function goBackToList() {
    setMobilePane('list')
    // Keep selected so desktop still shows it; clear on mobile only via CSS
  }

  async function handleSend() {
    if ((!draft.trim() && !pendingAttachment) || !selected || sending) return
    setSending(true)
    const body = draft.trim()
    const attachment = pendingAttachment
    setDraft('')
    setPendingAttachment(null)
    // Reset textarea height
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    const res = await fetch(`/api/v1/conversations/${selected.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: body || (attachment ? attachment.file_name ?? 'Faili' : ''),
        attachments: attachment ? [attachment] : undefined,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      const msg: Message = json.message
      if (msg) {
        setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, {
          ...msg,
          sender: msg.sender ?? { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
          attachments: attachment ? [{ file_url: attachment.url, file_name: attachment.file_name, file_type: attachment.file_type, file_size: attachment.file_size }] : [],
        }])
        setConversations((prev) => prev.map((c) =>
          c.id === selected.id ? { ...c, last_message_at: msg.created_at, last_message_body: body || '📎 Faili' } : c
        ))
      }
    } else {
      setDraft(body)
      setPendingAttachment(attachment)
    }
    setSending(false)
  }

  async function handleCreate() {
    if (!pickedContact || !newFirstMsg.trim() || creating) return
    setCreating(true)

    const isOrg = pickedContact.type === 'org'
    const body: Record<string, unknown> = {
      title: newTitle.trim() || null,
      conv_type: 'general',
      first_message: newFirstMsg.trim(),
    }

    if (isOrg) {
      body.org_id = pickedContact.org_id
      body.participant_ids = pickedContact.owner_id ? [pickedContact.owner_id] : []
    } else {
      body.participant_ids = [pickedContact.user_id!]
    }

    const res = await fetch('/api/v1/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setCreating(false)
    if (!res.ok) return

    const json = await res.json()
    setShowNewConv(false)
    setNewTitle(''); setNewFirstMsg(''); setPickedContact(null)
    await loadConversations()
    if (json.conversation) {
      openConversation(json.conversation)
    }
  }

  const filtered = conversations.filter((c) => {
    if (sourceTab !== 'all' && (c.source_role ?? null) !== sourceTab) return false
    if (!searchQ) return true
    return convLabel(c, currentUserId).toLowerCase().includes(searchQ.toLowerCase())
  })

  // ── Conversation List Panel ───────────────────────────────────────────────

  const listPanel = (
    <div
      className={`
        flex flex-col bg-white dark:bg-gray-900
        w-full md:w-72 md:flex-shrink-0
        border-r border-gray-200 dark:border-gray-700
        absolute inset-0 md:relative
        transition-transform duration-200
        ${mobilePane === 'thread' ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
      `}
    >
      <div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Ujumbe wa Ndani</h2>
          <button
            onClick={() => setShowNewConv(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 transition-colors"
            title="Mazungumzo Mapya"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <input
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="Tafuta mazungumzo..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {/* Source filter chips */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSourceTab(t.key)}
              className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap
                ${sourceTab === t.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              {t.label}
              {t.key !== 'all' && (() => {
                const cnt = conversations.filter((c) => c.source_role === t.key && c.unread_count > 0).length
                return cnt > 0 ? <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1">{cnt}</span> : null
              })()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-gray-400 text-center">Inapakia...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-400">Hakuna mazungumzo bado</p>
            <button onClick={() => setShowNewConv(true)} className="mt-2 text-xs text-primary-600 hover:underline">
              Anza mazungumzo mapya
            </button>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = selected?.id === conv.id
            const label = convLabel(conv, currentUserId)
            const otherP = (conv.participants ?? []).find((p) => p.user_id !== currentUserId)
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left p-3 flex items-start gap-3 border-b border-gray-100 dark:border-gray-800 transition-colors active:bg-gray-100 dark:active:bg-gray-800 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <Avatar src={otherP?.user?.avatar_url} name={otherP?.user?.full_name ?? label} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm truncate flex-1 ${conv.unread_count > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {label}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="flex-shrink-0 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                    <span className="text-xs text-gray-300 flex-shrink-0">{relativeTime(conv.last_message_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {convTypeTag(conv)}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {conv.last_message_body ?? 'Bonyeza kuanza'}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  // ── Thread Panel ──────────────────────────────────────────────────────────

  const threadPanel = !selected ? (
    // Desktop empty state only — hidden on mobile
    <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <svg className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <p className="text-gray-400 text-sm">Chagua mazungumzo kuanza</p>
      </div>
    </div>
  ) : (
    <div
      className={`
        flex flex-col bg-white dark:bg-gray-900
        flex-1 min-w-0
        absolute inset-0 md:relative
        transition-transform duration-200
        ${mobilePane === 'list' ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}
      `}
    >
      {/* Thread header */}
      <div className="h-14 flex items-center px-3 md:px-4 border-b border-gray-200 dark:border-gray-700 gap-2 md:gap-3 flex-shrink-0">
        {/* Back button — mobile only */}
        <button
          onClick={goBackToList}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
          aria-label="Rudi kwenye orodha"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar
          src={(selected.participants ?? []).find((p) => p.user_id !== currentUserId)?.user?.avatar_url}
          name={convLabel(selected, currentUserId)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{convLabel(selected, currentUserId)}</p>
            {convTypeTag(selected)}
          </div>
          <p className="text-xs text-gray-400">{(selected.participants ?? []).length} washiriki</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-3">
        {loadingThread ? (
          <div className="text-center text-sm text-gray-400 py-8">Inapakia...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">Hakuna ujumbe. Anza mazungumzo!</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            const name = isMe ? currentUserName : (msg.sender?.full_name ?? 'Mtumiaji')
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && <Avatar src={msg.sender?.avatar_url} name={name} size={7} />}
                <div className={`flex flex-col gap-0.5 max-w-[78%] md:max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-xs text-gray-400 px-1">{name}</span>}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-primary-500 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'}`}>
                    {msg.body}
                    {msg.attachments?.length ? <AttachmentDisplay attachments={msg.attachments} /> : null}
                  </div>
                  <span className="text-xs text-gray-300 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-2 md:p-3 space-y-2 bg-white dark:bg-gray-900">
        {pendingAttachment && (
          <AttachmentCompose
            attachment={pendingAttachment}
            onAttach={setPendingAttachment}
            onRemove={() => setPendingAttachment(null)}
          />
        )}
        <div className="flex items-end gap-2">
          <AttachmentCompose
            attachment={null}
            onAttach={setPendingAttachment}
            onRemove={() => setPendingAttachment(null)}
          />
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 leading-snug overflow-hidden"
            rows={1}
            style={{ maxHeight: '128px' }}
            placeholder="Andika ujumbe..."
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={(e) => {
              // Enter sends only on desktop (shift+enter = newline everywhere)
              if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!draft.trim() && !pendingAttachment) || sending}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:opacity-40 transition-colors flex-shrink-0"
            aria-label="Tuma"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Main layout: relative container lets absolute children fill it on mobile */}
      <div className="relative flex h-[calc(100dvh-4rem)] bg-white dark:bg-gray-900 overflow-hidden">
        {listPanel}
        {threadPanel}
      </div>

      {/* ── New Conversation Modal ─────────────────────────────────────────────── */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mazungumzo Mapya</h3>
              <button
                onClick={() => setShowNewConv(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
              {/* Contact type tabs */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Aina ya Mpokeaji</p>
                <div className="grid grid-cols-5 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                  {CONTACT_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => { setContactTab(tab.key); setPickedContact(null); setContactSearch('') }}
                      className={`text-xs py-2 px-1 rounded-lg font-medium transition-colors text-center ${
                        contactTab === tab.key
                          ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact search + pick */}
              <div>
                <input
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder={`Tafuta ${CONTACT_TABS.find((t) => t.key === contactTab)?.label ?? ''}...`}
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />

                {pickedContact ? (
                  <div className="mt-2 flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl px-3 py-2.5">
                    <Avatar src={pickedContact.avatar_url} name={pickedContact.name} size={7} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{pickedContact.name}</p>
                      {pickedContact.subtitle && <p className="text-xs text-gray-400">{pickedContact.subtitle}</p>}
                    </div>
                    {roleBadge(pickedContact.type)}
                    <button
                      onClick={() => setPickedContact(null)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 ml-1 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
                    {contactsLoading ? (
                      <div className="p-3 text-xs text-gray-400 text-center">Inapakia...</div>
                    ) : contacts.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 text-center">Hakuna matokeo</div>
                    ) : (
                      contacts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setPickedContact(c)}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 text-left"
                        >
                          <Avatar src={c.avatar_url} name={c.name} size={7} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                            {c.subtitle && <p className="text-xs text-gray-400 truncate">{c.subtitle}</p>}
                          </div>
                          {roleBadge(c.type)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Title (optional) */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kichwa (hiari)</label>
                <input
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Mfano: Tatizo la malipo..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              {/* First message */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ujumbe wa Kwanza</label>
                <textarea
                  className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                  rows={3}
                  placeholder="Andika ujumbe wako wa kwanza..."
                  value={newFirstMsg}
                  onChange={(e) => setNewFirstMsg(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 md:p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowNewConv(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors"
              >
                Ghairi
              </button>
              <button
                onClick={handleCreate}
                disabled={!pickedContact || !newFirstMsg.trim() || creating}
                className="flex-1 py-2.5 text-sm bg-primary-500 text-white rounded-xl hover:bg-primary-600 active:bg-primary-700 disabled:opacity-40 transition-colors font-medium"
              >
                {creating ? 'Inaunda...' : 'Anza Mazungumzo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
