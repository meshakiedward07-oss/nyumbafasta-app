'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  user_id: string
  role: string
  last_read_at: string | null
  user: { id: string; full_name: string | null; avatar_url: string | null }
}

interface Conversation {
  id: string
  title: string | null
  conv_type: string
  status: string
  last_message_at: string | null
  created_at: string
  unread_count: number
  last_message_body: string | null
  last_message_sender: string | null
  participants: Participant[]
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  message_type: string
  is_internal: boolean
  created_at: string
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface StaffUser {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Sasa hivi'
  if (m < 60) return `Dakika ${m} zilizopita`
  const h = Math.floor(m / 60)
  if (h < 24) return `Masaa ${h} yaliyopita`
  return `Siku ${Math.floor(h / 24)} zilizopita`
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

function convTitle(conv: Conversation, currentUserId: string): string {
  if (conv.title) return conv.title
  const others = conv.participants
    ?.filter((p) => p.user_id !== currentUserId)
    .map((p) => p.user?.full_name ?? 'Mtumiaji')
  if (!others?.length) return 'Mazungumzo'
  return others.slice(0, 3).join(', ')
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
}

export default function MessagesPanel({ currentUserId, currentUserName, currentUserAvatar }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newParticipants, setNewParticipants] = useState<string[]>([])
  const [newFirstMsg, setNewFirstMsg] = useState('')
  const [creating, setCreating] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
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
    // Mark as read
    await fetch(`/api/v1/conversations/${convId}/read`, { method: 'POST' })
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c))
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Supabase realtime: listen for new messages in the selected conversation
  useEffect(() => {
    if (!selected) return
    const channel = supabase
      .channel(`messages-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev
          // sender name may not be in the payload; reload thread to get it
          loadThread(selected.id)
          return prev
        })
        // Also refresh conversation list for last_message
        loadConversations()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // Poll as fallback every 30s
  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => { loadThread(selected.id); loadConversations() }, 30000)
    return () => clearInterval(t)
  }, [selected, loadThread, loadConversations])

  useEffect(() => {
    if (selected) { loadThread(selected.id) }
  }, [selected, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadStaffUsers() {
    const res = await fetch('/api/v1/conversations/staff-users')
    if (res.ok) {
      const json = await res.json()
      setStaffUsers(json.users ?? [])
    }
  }

  async function handleSend() {
    if (!draft.trim() || !selected || sending) return
    setSending(true)
    const body = draft.trim()
    setDraft('')
    const res = await fetch(`/api/v1/conversations/${selected.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body }),
    })
    if (res.ok) {
      const json = await res.json()
      const msg: Message = json.message
      if (msg) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev
          return [...prev, { ...msg, sender: msg.sender ?? { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar } }]
        })
        setConversations((prev) => prev.map((c) =>
          c.id === selected.id ? { ...c, last_message_at: msg.created_at, last_message_body: body } : c
        ))
      }
    } else {
      setDraft(body) // restore on failure
    }
    setSending(false)
  }

  async function handleCreate() {
    if (!newParticipants.length || !newFirstMsg.trim() || creating) return
    setCreating(true)
    const res = await fetch('/api/v1/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim() || null,
        conv_type: 'general',
        participant_ids: newParticipants,
        first_message: newFirstMsg.trim(),
      }),
    })
    setCreating(false)
    if (!res.ok) return
    const json = await res.json()
    setShowNewConv(false)
    setNewTitle(''); setNewParticipants([]); setNewFirstMsg('')
    await loadConversations()
    if (json.conversation) setSelected(json.conversation)
  }

  const filtered = conversations.filter((c) => {
    if (!searchQ) return true
    const title = convTitle(c, currentUserId).toLowerCase()
    return title.includes(searchQ.toLowerCase())
  })

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
      {/* ── Left: Conversation List ─────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Ujumbe wa Ndani</h2>
            <button
              onClick={() => { setShowNewConv(true); loadStaffUsers() }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors"
              title="Mazungumzo Mapya"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <input
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400"
            placeholder="Tafuta mazungumzo..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-400 text-center">Inapakia...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-400">Hakuna mazungumzo bado</p>
              <button
                onClick={() => { setShowNewConv(true); loadStaffUsers() }}
                className="mt-3 text-xs text-primary-600 hover:underline"
              >
                Anza mazungumzo mapya
              </button>
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = selected?.id === conv.id
              const title = convTitle(conv, currentUserId)
              const otherParticipant = conv.participants?.find((p) => p.user_id !== currentUserId)
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                >
                  <Avatar src={otherParticipant?.user?.avatar_url} name={otherParticipant?.user?.full_name ?? title} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {title}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="flex-shrink-0 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {conv.last_message_body ?? 'Hakuna ujumbe bado'}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">{relativeTime(conv.last_message_at)}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right: Thread ─────────────────────────────────────────────────────── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-gray-400 text-sm">Chagua mazungumzo kuanza</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-700 gap-3">
            <Avatar
              src={selected.participants?.find((p) => p.user_id !== currentUserId)?.user?.avatar_url}
              name={convTitle(selected, currentUserId)}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{convTitle(selected, currentUserId)}</p>
              <p className="text-xs text-gray-400">
                {selected.participants?.length ?? 0} washiriki
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingThread ? (
              <div className="text-center text-sm text-gray-400 py-8">Inapakia...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">Hakuna ujumbe bado. Anza mazungumzo!</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                const senderName = isMe ? currentUserName : (msg.sender?.full_name ?? 'Mtumiaji')
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && <Avatar src={msg.sender?.avatar_url} name={senderName} size={7} />}
                    <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMe && (
                        <span className="text-xs text-gray-400 px-1">{senderName}</span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-primary-500 text-white rounded-tr-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
                      }`}>
                        {msg.body}
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
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400 max-h-32"
                rows={1}
                placeholder="Andika ujumbe..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Conversation Modal ────────────────────────────────────────────── */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mazungumzo Mapya</h3>
              <button onClick={() => setShowNewConv(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kichwa (hiari)</label>
                <input
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400"
                  placeholder="Mfano: Mkutano wa timu..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Washiriki</label>
                {staffUsers.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-400">Inapakia wafanyakazi...</p>
                ) : (
                  <div className="mt-1 max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    {staffUsers
                      .filter((u) => u.id !== currentUserId)
                      .map((u) => (
                        <label key={u.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newParticipants.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) setNewParticipants((p) => [...p, u.id])
                              else setNewParticipants((p) => p.filter((id) => id !== u.id))
                            }}
                            className="accent-primary-500"
                          />
                          <Avatar src={u.avatar_url} name={u.full_name} size={6} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{u.full_name ?? 'Mtumiaji'}</span>
                          <span className="text-xs text-gray-400 ml-auto">{u.role}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ujumbe wa Kwanza</label>
                <textarea
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none"
                  rows={3}
                  placeholder="Andika ujumbe wako wa kwanza..."
                  value={newFirstMsg}
                  onChange={(e) => setNewFirstMsg(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowNewConv(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Ghairi
              </button>
              <button
                onClick={handleCreate}
                disabled={!newParticipants.length || !newFirstMsg.trim() || creating}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Inaunda...' : 'Anza Mazungumzo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
