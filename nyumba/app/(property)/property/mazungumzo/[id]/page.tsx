'use client'
import { useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import { CONV_TYPE_LABELS } from '@/lib/types/property'
import type { Conversation, Message } from '@/lib/types/property'
import AttachmentCompose, { type PendingAttachment } from '@/components/messages/AttachmentCompose'
import AttachmentDisplay from '@/components/messages/AttachmentDisplay'
import { useLanguage } from '@/lib/i18n/context'

interface MsgAttachment {
  id?: string; file_url: string; file_name: string | null; file_type: string | null; file_size: number | null
}

type RawMsg = Message & {
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
  attachments?: MsgAttachment[]
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ name, url, size = 8 }: { name: string | null; url: string | null; size?: number }) {
  const sz = `w-${size} h-${size}`
  return (
    <div className={`${sz} rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center overflow-hidden`}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <span className="text-primary-600 font-bold text-xs">{name?.charAt(0)?.toUpperCase() ?? '?'}</span>
      }
    </div>
  )
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useLanguage()
  const [conv,     setConv]    = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<RawMsg[]>([])
  const [userId,   setUserId]  = useState<string | null>(null)
  const [isOrgMem, setIsOrgMem] = useState(false)
  const [loading,           setLoading]           = useState(true)
  const [sending,           setSending]           = useState(false)
  const [input,             setInput]             = useState('')
  const [isNote,            setIsNote]            = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const scrollBoxRef = useRef<HTMLDivElement>(null)

  async function fetchThread(markRead = true) {
    const [threadRes, meRes] = await Promise.all([
      fetch(`/api/v1/conversations/${id}`),
      fetch('/api/v1/auth/me'),
    ])
    const threadData = await threadRes.json()
    const meData     = await meRes.json()
    const me         = meData.user
    setUserId(me?.id ?? null)

    if (threadData.conversation) setConv(threadData.conversation)
    if (threadData.messages)     setMessages(threadData.messages)
    // Clear any previous error on successful fetch
    setError(null)

    // Check if user is org member
    if (threadData.conversation?.org_id && me?.id) {
      const orgRes  = await fetch('/api/v1/organizations')
      const orgData = await orgRes.json()
      const orgs    = orgData.organizations ?? []
      setIsOrgMem(orgs.some((o: { organization: { id: string } }) => o.organization.id === threadData.conversation.org_id))
    }

    // Mark as read and notify shell to refresh unread badge immediately
    if (markRead) {
      fetch(`/api/v1/conversations/${id}/read`, { method: 'POST' })
        .then(() => window.dispatchEvent(new Event('nyumba:marked-read')))
        .catch(() => {})
    }
  }

  useEffect(() => {
    fetchThread()
      .catch(() => setError(t('pr_mazungumzo_err_load')))
      .finally(() => setLoading(false))

    // Poll every 5s for new messages
    const poll = setInterval(() => {
      fetchThread(false).catch(() => {})
    }, 5_000)
    return () => clearInterval(poll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Scroll to bottom on initial load and when the user sends their own message.
  // Do NOT auto-scroll on background poll updates to avoid interrupting reading.
  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }

  useEffect(() => {
    if (!loading) scrollToBottom(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function handleSend() {
    if ((!input.trim() && !pendingAttachment) || sending) return
    setSending(true)
    const body       = input.trim()
    const attachment = pendingAttachment
    setInput('')
    setIsNote(false)
    setPendingAttachment(null)
    try {
      const res  = await fetch(`/api/v1/conversations/${id}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     body || (attachment ? attachment.file_name ?? 'Faili' : ''),
          is_internal: isNote,
          attachments: attachment ? [{ file_url: attachment.url, file_name: attachment.file_name, file_type: attachment.file_type, file_size: attachment.file_size }] : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('pr_mazungumzo_err_msg')); return }
      setMessages(prev => [...prev, data.message as RawMsg])
      scrollToBottom()
    } catch {
      setError(t('pr_mazungumzo_err_send'))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && (input.trim() || pendingAttachment)) {
      e.preventDefault()
      handleSend()
    }
  }

  const participants = (conv?.participants as unknown as Array<{
    user_id: string
    user: { id: string; full_name: string | null; avatar_url: string | null } | null
  }>) ?? []
  const others = participants.filter(p => p.user_id !== userId)

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link href="/property/mazungumzo" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <i className="ti ti-arrow-left text-xl" aria-hidden="true" />
        </Link>

        {loading ? (
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-100 animate-pulse rounded-full" />
            <div className="h-3 w-20 bg-gray-100 animate-pulse rounded-full mt-1" />
          </div>
        ) : (
          <>
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {others.slice(0, 3).map(p => (
                <Avatar key={p.user_id} name={p.user?.full_name ?? null} url={p.user?.avatar_url ?? null} size={9} />
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {conv?.title ?? others.map(p => p.user?.full_name ?? t('pr_mazungumzo_user_fallback')).join(', ')}
              </p>
              <p className="text-xs text-gray-400">
                {CONV_TYPE_LABELS[conv?.conv_type ?? 'general']} · {participants.length} {t('pr_mazungumzo_participants')}
              </p>
            </div>

            {/* Status chip */}
            {conv?.status === 'closed' && (
              <span className="flex-shrink-0 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{t('pr_mazungumzo_closed_status')}</span>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollBoxRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-end' : ''}`}>
                {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />}
                <div className={`h-10 animate-pulse rounded-2xl ${i % 2 === 0 ? 'bg-primary-100 w-40' : 'bg-gray-100 w-52'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <i className="ti ti-message text-4xl text-gray-200" aria-hidden="true" />
            <p className="text-sm text-gray-400 mt-2">{t('pr_mazungumzo_no_messages')}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe      = msg.sender_id === userId
            const isSystem  = msg.message_type === 'system'
            const showAvatar= !isMe && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id)
            const sender    = msg.sender as unknown as { id: string; full_name: string | null; avatar_url: string | null } | null

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <span className="text-[11px] text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    {msg.body}
                  </span>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-8 flex-shrink-0 self-end">
                    {showAvatar && <Avatar name={sender?.full_name ?? null} url={sender?.avatar_url ?? null} size={8} />}
                  </div>
                )}

                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {showAvatar && !isMe && (
                    <span className="text-[10px] text-gray-400 ml-0.5">{sender?.full_name ?? t('pr_mazungumzo_user_fallback')}</span>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? msg.is_internal
                          ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-br-sm'
                          : 'bg-primary-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.is_internal && (
                      <span className="block text-[10px] font-semibold text-amber-600 mb-1">
                        <i className="ti ti-lock mr-1" aria-hidden="true" />{t('pr_mazungumzo_internal_note')}
                      </span>
                    )}
                    {msg.body && <p>{msg.body}</p>}
                    {msg.attachments?.length ? <AttachmentDisplay attachments={msg.attachments} /> : null}
                  </div>
                  <span className="text-[10px] text-gray-400 mx-0.5">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            )
          })
        )}

        {error && (
          <div className="flex justify-center">
            <span className="text-xs text-red-500 bg-red-50 px-3 py-1 rounded-full">{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {conv?.status !== 'closed' ? (
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 py-2">
          {/* Internal note toggle for org members */}
          {isOrgMem && (
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={() => setIsNote(n => !n)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                  isNote ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-400 hover:text-gray-600'
                }`}
              >
                <i className={`ti ti-lock${isNote ? '' : '-open'}`} aria-hidden="true" />
                {isNote ? t('pr_mazungumzo_internal_toggle') : t('pr_mazungumzo_normal_toggle')}
              </button>
            </div>
          )}

          {pendingAttachment && (
            <div className="mb-2">
              <AttachmentCompose
                attachment={pendingAttachment}
                onAttach={setPendingAttachment}
                onRemove={() => setPendingAttachment(null)}
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <AttachmentCompose
              attachment={null}
              onAttach={setPendingAttachment}
              onRemove={() => setPendingAttachment(null)}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isNote ? t('pr_mazungumzo_note_ph') : t('pr_mazungumzo_type_ph2')}
              className={`flex-1 resize-none border rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 max-h-32 leading-relaxed ${
                isNote
                  ? 'border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-200 placeholder:text-amber-400'
                  : 'border-gray-200 bg-gray-50 focus:ring-primary-200 placeholder:text-gray-400'
              }`}
              style={{ overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingAttachment) || sending}
              className="w-10 h-10 bg-primary-500 text-white rounded-2xl flex items-center justify-center hover:bg-primary-600 transition disabled:opacity-40 flex-shrink-0"
              aria-label="Tuma"
            >
              {sending
                ? <i className="ti ti-loader-2 animate-spin text-lg" aria-hidden="true" />
                : <i className="ti ti-send text-lg" aria-hidden="true" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 ml-1">{t('pr_mazungumzo_enter_hint')}</p>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3 text-center">
          <p className="text-sm text-gray-500">{t('pr_mazungumzo_closed_msg')}</p>
        </div>
      )}
    </div>
  )
}
