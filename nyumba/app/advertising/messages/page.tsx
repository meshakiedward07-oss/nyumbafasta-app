'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AttachmentCompose, { type PendingAttachment } from '@/components/messages/AttachmentCompose'
import AttachmentDisplay from '@/components/messages/AttachmentDisplay'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffContact {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
}

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

function relativeTime(iso: string | null, t: (k: TKey) => string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('adv_just_now')
  if (m < 60) return t('adv_minutes_ago').replace('{n}', String(m))
  const h = Math.floor(m / 60)
  if (h < 24) return t('adv_hours_ago').replace('{n}', String(h))
  return t('adv_days_ago').replace('{n}', String(Math.floor(h / 24)))
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

function convLabel(conv: Conversation, uid: string, t: (k: TKey) => string): string {
  if (conv.title) return conv.title
  const others = (conv.participants ?? [])
    .filter((p) => p.user_id !== uid)
    .map((p) => p.user?.full_name ?? t('adv_user_label'))
  return others.length ? others.slice(0, 2).join(', ') : t('adv_conversation_label')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdvertiserMessagesPage() {
  const { t } = useLanguage()
  const [uid, setUid] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
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

  const [showNew, setShowNew] = useState(false)
  const [staffContacts, setStaffContacts] = useState<StaffContact[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [pickedStaff, setPickedStaff] = useState<StaffContact | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const [creating, setCreating] = useState(false)

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

  const loadStaffContacts = useCallback(async () => {
    setStaffLoading(true)
    const res = await fetch('/api/v1/conversations/advertiser-contacts')
    if (res.ok) {
      const json = await res.json()
      setStaffContacts(json.contacts ?? [])
    }
    setStaffLoading(false)
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
        setUserName(j.user?.full_name ?? '')
        setUserAvatar(j.user?.avatar_url ?? null)
      })
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!selected) return
    realtimeOk.current = false
    const ch = supabase
      .channel(`adv-messages-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, () => { loadThread(selected.id); loadConversations() })
      .subscribe(status => { if (status === 'SUBSCRIBED') realtimeOk.current = true })
    return () => { realtimeOk.current = false; supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return
    const timer = setInterval(() => {
      if (!realtimeOk.current) { loadThread(selected.id); loadConversations() }
    }, 30000)
    return () => clearInterval(timer)
  }, [selected, loadThread, loadConversations])

  useEffect(() => {
    if (selected) loadThread(selected.id)
  }, [selected, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function handleSend() {
    if ((!draft.trim() && !pendingAttachment) || !selected || sending || !uid) return
    setSending(true)
    const body = draft.trim()
    const attachment = pendingAttachment
    setDraft('')
    setPendingAttachment(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const res = await fetch(`/api/v1/conversations/${selected.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: body || (attachment ? attachment.file_name ?? 'Faili' : ''),
        attachments: attachment ? [{ file_url: attachment.url, file_name: attachment.file_name, file_type: attachment.file_type, file_size: attachment.file_size }] : undefined,
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

  async function createConversation() {
    if (!pickedStaff || creating) return
    setCreating(true)
    const res = await fetch('/api/v1/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_ids: [pickedStaff.id],
        first_message: newMsg.trim() || t('adv_default_first_msg'),
      }),
    })
    if (res.ok) {
      const json = await res.json()
      setShowNew(false); setPickedStaff(null); setNewMsg('')
      await loadConversations()
      if (json.conversation) setSelected(json.conversation)
    }
    setCreating(false)
  }

  const filtered = conversations.filter((c) =>
    !searchQ || convLabel(c, uid ?? '', t).toLowerCase().includes(searchQ.toLowerCase())
  )

  // ── Conversation List ──────────────────────────────────────────────────────

  const ConversationList = (
    <div className={`flex flex-col bg-white border-r border-gray-100 ${selected ? 'hidden lg:flex lg:w-80 lg:flex-shrink-0' : 'flex-1 lg:w-80 lg:flex-shrink-0'}`}>
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-base">{t('adv_messages_title')}</h2>
          <button
            onClick={() => { setShowNew(true); loadStaffContacts() }}
            className="w-8 h-8 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-colors"
            title={t('adv_contact_support')}
          >
            <i className="ti ti-pencil text-sm" aria-hidden="true" />
          </button>
        </div>
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
          <input
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder={t('adv_search_conversations')}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <i className="ti ti-message-circle-off text-5xl text-gray-200 block mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-400">{t('adv_no_messages')}</p>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed mb-4">
              {t('adv_no_messages_desc')}
            </p>
            <button
              onClick={() => { setShowNew(true); loadStaffContacts() }}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold"
            >
              {t('adv_start_conversation')}
            </button>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = selected?.id === conv.id
            const label = convLabel(conv, uid ?? '', t)
            const otherP = (conv.participants ?? []).find((p) => p.user_id !== uid)
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 border-b border-gray-50 transition-colors active:bg-gray-50
                  ${isActive ? 'bg-primary-50 border-l-2 border-l-primary-500' : 'hover:bg-gray-50'}`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={otherP?.user?.avatar_url} name={otherP?.user?.full_name ?? label} size={10} />
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-300 flex-shrink-0 whitespace-nowrap">
                      {relativeTime(conv.last_message_at, t)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{conv.last_message_body ?? t('adv_tap_to_view')}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full px-1">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  // ── Thread Panel ───────────────────────────────────────────────────────────

  const ThreadPanel = selected ? (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0"
          onClick={() => setSelected(null)}
        >
          <i className="ti ti-arrow-left text-base" aria-hidden="true" />
        </button>
        <Avatar
          src={(selected.participants ?? []).find((p) => p.user_id !== uid)?.user?.avatar_url}
          name={convLabel(selected, uid ?? '', t)}
          size={9}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{convLabel(selected, uid ?? '', t)}</p>
          <p className="text-xs text-gray-400">{t('adv_support_team')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4 bg-gray-50">
        {loadingThread ? (
          <div className="flex flex-col gap-4 pt-4">
            {[1,2,3].map(i => (
              <div key={i} className={`flex gap-2 animate-pulse ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
                <div className={`h-10 rounded-2xl bg-gray-200 ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <i className="ti ti-message text-5xl text-gray-200 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-400">{t('adv_no_messages')}</p>
            <p className="text-xs text-gray-300 mt-1">{t('adv_start_chat_hint')}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === uid
            const name = isMe ? (userName || t('adv_you')) : (msg.sender?.full_name ?? t('adv_team'))
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && <Avatar src={msg.sender?.avatar_url} name={name} size={7} />}
                <div className={`flex flex-col gap-1 max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-xs text-gray-400 px-1">{name}</span>}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
                    ${isMe ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100'}`}
                  >
                    {msg.body && <p>{msg.body}</p>}
                    {msg.attachments?.length ? <AttachmentDisplay attachments={msg.attachments} /> : null}
                  </div>
                  <span className="text-[10px] text-gray-300 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 bg-white border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {pendingAttachment && (
          <div className="px-3 pt-3">
            <AttachmentCompose attachment={pendingAttachment} onAttach={setPendingAttachment} onRemove={() => setPendingAttachment(null)} />
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-3">
          <div className="flex-shrink-0">
            <AttachmentCompose attachment={null} onAttach={setPendingAttachment} onRemove={() => setPendingAttachment(null)} />
          </div>
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none px-3 py-2.5 text-sm rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 placeholder-gray-400 leading-relaxed"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            rows={1}
            placeholder={t('adv_message_placeholder')}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <button
            onClick={handleSend}
            disabled={(!draft.trim() && !pendingAttachment) || sending}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <i className="ti ti-send text-lg" aria-hidden="true" />
            }
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
      <div className="text-center">
        <i className="ti ti-messages text-6xl text-gray-200 block mb-3" aria-hidden="true" />
        <p className="text-gray-400 text-sm font-medium">{t('adv_select_conversation')}</p>
        <p className="text-xs text-gray-300 mt-1">{t('adv_or_start_new')}</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="flex h-[calc(100dvh-4rem)] bg-white overflow-hidden">
        {ConversationList}
        {ThreadPanel}
      </div>

      {/* New Conversation sheet */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNew(false); setPickedStaff(null); setNewMsg('') } }}
        >
          <div className="bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[80dvh] flex flex-col"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">{t('adv_contact_team')}</p>
              <button
                onClick={() => { setShowNew(false); setPickedStaff(null); setNewMsg('') }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                <i className="ti ti-x text-sm" aria-hidden="true" />
              </button>
            </div>

            {!pickedStaff ? (
              <div className="flex-1 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-3">{t('adv_select_staff')}</p>
                {staffLoading ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-gray-100" />
                        <div className="flex-1 h-4 bg-gray-100 rounded" />
                      </div>
                    ))}
                  </div>
                ) : staffContacts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">{t('adv_no_staff')}</p>
                ) : (
                  <div className="space-y-1">
                    {staffContacts.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setPickedStaff(s)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 text-left transition-colors"
                      >
                        <Avatar src={s.avatar_url} name={s.full_name} size={10} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name ?? t('adv_staff_role')}</p>
                          <p className="text-xs text-gray-400 capitalize">
                            {s.role === 'admin' ? t('adv_admin_role') : t('adv_staff_role')}
                          </p>
                        </div>
                        <i className="ti ti-chevron-right text-gray-300 flex-shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button onClick={() => setPickedStaff(null)} className="flex items-center gap-2 text-xs text-primary-600 font-medium -mt-1">
                  <i className="ti ti-arrow-left text-sm" aria-hidden="true" /> {t('adv_change_person')}
                </button>
                <div className="flex items-center gap-3 px-3 py-3 bg-primary-50 rounded-xl">
                  <Avatar src={pickedStaff.avatar_url} name={pickedStaff.full_name} size={9} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{pickedStaff.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {pickedStaff.role === 'admin' ? t('adv_admin_role') : t('adv_staff_role')}
                    </p>
                  </div>
                </div>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 placeholder-gray-400"
                  rows={3}
                  placeholder={t('adv_first_message_placeholder')}
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                />
                <button
                  onClick={createConversation}
                  disabled={creating}
                  className="w-full py-3 bg-primary-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <><i className="ti ti-send text-sm" aria-hidden="true" />{t('adv_send_message')}</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
