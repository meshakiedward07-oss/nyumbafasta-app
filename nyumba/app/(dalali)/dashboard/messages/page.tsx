'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AttachmentCompose, { type PendingAttachment } from '@/components/messages/AttachmentCompose'
import AttachmentDisplay from '@/components/messages/AttachmentDisplay'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  user_id: string
  role: string
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface Conversation {
  id: string
  title: string | null
  conv_type: string
  status: string
  last_message_at: string | null
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
  sender_id: string
  body: string
  created_at: string
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
  attachments?: Attachment[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Sasa hivi'
  if (m < 60) return `Dakika ${m} zilizopita`
  const h = Math.floor(m / 60)
  if (h < 24) return `Saa ${h} zilizopita`
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

function convLabel(conv: Conversation, uid: string): string {
  if (conv.title) return conv.title
  const others = (conv.participants ?? [])
    .filter((p) => p.user_id !== uid)
    .map((p) => p.user?.full_name ?? 'Mtumiaji')
  return others.length ? others.slice(0, 2).join(', ') : 'Mazungumzo'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DalaliMessagesPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [userName, setUserName] = useState('Dalali')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
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
    await fetch(`/api/v1/conversations/${convId}/read`, { method: 'POST' })
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c))
  }, [])

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => r.json())
      .then((j) => {
        setUid(j.user?.id ?? null)
        setUserName(j.user?.full_name ?? 'Dalali')
        setUserAvatar(j.user?.avatar_url ?? null)
      })
    loadConversations()
  }, [loadConversations])

  // Realtime for selected conversation
  useEffect(() => {
    if (!selected) return
    const ch = supabase
      .channel(`dalali-messages-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, () => { loadThread(selected.id); loadConversations() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => { loadThread(selected.id); loadConversations() }, 30000)
    return () => clearInterval(t)
  }, [selected, loadThread, loadConversations])

  useEffect(() => {
    if (selected) loadThread(selected.id)
  }, [selected, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if ((!draft.trim() && !pendingAttachment) || !selected || sending || !uid) return
    setSending(true)
    const body = draft.trim()
    const attachment = pendingAttachment
    setDraft('')
    setPendingAttachment(null)
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
          sender: msg.sender ?? { id: uid, full_name: userName, avatar_url: userAvatar },
          attachments: attachment ? [{ file_url: attachment.url, file_name: attachment.file_name, file_type: attachment.file_type, file_size: attachment.file_size }] : [],
        }])
      }
    } else {
      setDraft(body)
      setPendingAttachment(attachment)
    }
    setSending(false)
  }

  const filtered = conversations.filter((c) =>
    !searchQ || convLabel(c, uid ?? '').toLowerCase().includes(searchQ.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100dvh-5rem)] bg-white">
      {/* ── Conversation List ───────────────────────────────────────────────── */}
      <div className="w-full max-w-xs flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Ujumbe Wangu</h2>
          <input
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="Tafuta mazungumzo..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-400 text-center">Inapakia...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm text-gray-400">Hakuna ujumbe bado</p>
              <p className="text-xs text-gray-300 mt-1">Timu ya NyumbaFasta itawasiliana nawe hapa</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = selected?.id === conv.id
              const label = convLabel(conv, uid ?? '')
              const otherP = (conv.participants ?? []).find((p) => p.user_id !== uid)
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-3 flex items-start gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${isActive ? 'bg-primary-50' : ''}`}
                >
                  <div className="relative">
                    <Avatar src={otherP?.user?.avatar_url} name={otherP?.user?.full_name ?? label} />
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-gray-300 flex-shrink-0 ml-1">{relativeTime(conv.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message_body ?? 'Bonyeza kuona'}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Thread ───────────────────────────────────────────────────────────── */}
      {!selected ? (
        <div className="hidden sm:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <svg className="w-14 h-14 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-gray-400 text-sm">Chagua mazungumzo kushoto</p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col min-w-0 ${!selected ? 'hidden sm:flex' : 'flex'}`}>
          <div className="h-14 flex items-center px-4 border-b border-gray-100 gap-3">
            <button
              className="sm:hidden text-gray-400 mr-1"
              onClick={() => setSelected(null)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <Avatar
              src={(selected.participants ?? []).find((p) => p.user_id !== uid)?.user?.avatar_url}
              name={convLabel(selected, uid ?? '')}
            />
            <p className="font-semibold text-sm text-gray-900 truncate">{convLabel(selected, uid ?? '')}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingThread ? (
              <div className="text-center text-sm text-gray-400 py-8">Inapakia...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">Hakuna ujumbe bado.</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === uid
                const name = isMe ? userName : (msg.sender?.full_name ?? 'Timu')
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && <Avatar src={msg.sender?.avatar_url} name={name} size={7} />}
                    <div className={`flex flex-col gap-1 max-w-xs ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-xs text-gray-400 px-1">{name}</span>}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-primary-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
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

          <div className="p-3 border-t border-gray-100 space-y-2">
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
                className="flex-1 resize-none px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 max-h-28"
                rows={1}
                placeholder="Andika ujumbe..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />
              <button
                onClick={handleSend}
                disabled={(!draft.trim() && !pendingAttachment) || sending}
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
    </div>
  )
}
