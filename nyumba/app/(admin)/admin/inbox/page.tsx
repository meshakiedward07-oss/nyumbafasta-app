'use client'
import { useState, useEffect, useCallback } from 'react'

type MessageRow = {
  id:                string
  platform:          string
  sender_phone:      string | null
  sender_name:       string | null
  sender_id:         string | null
  message_text:      string
  category:          string
  confidence:        number
  reason:            string
  sub_category:      string
  action:            string
  auto_reply_sent:   string | null
  owner_reply:       string | null
  owner_replied_at:  string | null
  owner_notified_at: string | null
  flagged_at:        string | null
  created_at:        string
}

type Template = { id: string; label: string; message: string }

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp:  'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  facebook:  'bg-blue-100 text-blue-700',
  tiktok:    'bg-gray-100 text-gray-800',
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  flagged:      { label: 'Inahitaji jibu lako', color: 'bg-amber-100 text-amber-700' },
  auto_replied: { label: 'Amina alijibu',        color: 'bg-green-100 text-green-700' },
  owner_replied:{ label: 'Ulijibu',              color: 'bg-blue-100 text-blue-700'  },
  ignored:      { label: 'Spam (ilipuuzwa)',      color: 'bg-gray-100 text-gray-500'  },
  pending:      { label: 'Inasubiri',             color: 'bg-yellow-100 text-yellow-700' },
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'Sasa hivi'
  if (s < 3600)  return `Dakika ${Math.floor(s / 60)} zilizopita`
  if (s < 86400) return `Saa ${Math.floor(s / 3600)} zilizopita`
  return `Siku ${Math.floor(s / 86400)} zilizopita`
}

export default function InboxPage() {
  const [messages,       setMessages]       = useState<MessageRow[]>([])
  const [templates,      setTemplates]      = useState<Template[]>([])
  const [loading,        setLoading]        = useState(true)
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('flagged')
  const [selected,       setSelected]       = useState<MessageRow | null>(null)
  const [replyText,      setReplyText]      = useState('')
  const [sending,        setSending]        = useState(false)
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null)
  const [stats,          setStats]          = useState({ flagged: 0, autoReplied: 0, ownerReplied: 0, spam: 0 })

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/v1/inbox/stats')
    if (r.ok) {
      const d = await r.json() as typeof stats
      setStats(d)
    }
  }, [])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const [msgRes, tmplRes] = await Promise.all([
        fetch(`/api/v1/inbox/flagged?platform=${filterPlatform}&status=${filterStatus}`),
        fetch('/api/v1/inbox/templates'),
      ])
      const [msgData, tmplData] = await Promise.all([
        msgRes.json()  as Promise<{ messages: MessageRow[] }>,
        tmplRes.json() as Promise<{ templates: Template[] }>,
      ])
      setMessages(msgData.messages ?? [])
      setTemplates(tmplData.templates ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterPlatform, filterStatus])

  useEffect(() => { loadMessages(); loadStats() }, [loadMessages, loadStats])

  async function handleReply() {
    if (!selected || !replyText.trim()) return
    setSending(true)
    try {
      const res  = await fetch('/api/v1/inbox/reply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ classificationId: selected.id, replyText }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        showToast('✅ Jibu limetumwa!')
        setSelected(null)
        setReplyText('')
        loadMessages()
        loadStats()
      } else {
        showToast(`❌ ${data.error ?? 'Imeshindwa'}`, false)
      }
    } finally {
      setSending(false)
    }
  }

  const FILTER_TABS = [
    { key: 'flagged',       label: `Zinahitaji Jibu (${stats.flagged})`,  emoji: '🔴' },
    { key: 'auto_replied',  label: `Amina Alijibu (${stats.autoReplied})`,emoji: '🤖' },
    { key: 'owner_replied', label: `Ulijibu (${stats.ownerReplied})`,     emoji: '✅' },
    { key: 'spam',          label: `Spam (${stats.spam})`,                emoji: '🚫' },
  ]

  const senderLabel = (m: MessageRow) =>
    m.sender_name ?? m.sender_phone ?? m.sender_id ?? 'Haijulikani'

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm text-white font-medium ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📬 Kisanduku cha Ujumbe</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Amina anashughulikia biashara — wewe unashughulikia kibinafsi
            </p>
          </div>
          {stats.flagged > 0 && (
            <div className="flex-shrink-0 bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm animate-pulse">
              🔴 {stats.flagged} zinahitaji jibu lako
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                filterStatus === tab.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'whatsapp', 'instagram', 'facebook'].map(p => (
            <button
              key={p}
              onClick={() => setFilterPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterPlatform === p
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {p === 'all' ? 'Zote' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Messages list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-5 flex gap-4 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-40" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-500 font-medium">Hakuna ujumbe wa aina hii</p>
              <p className="text-sm text-gray-400 mt-1">Amina anashughulikia biashara zote kiotomatiki</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {messages.map(msg => {
                const actCfg   = ACTION_CONFIG[msg.action] ?? ACTION_CONFIG['pending']
                const platClr  = PLATFORM_COLORS[msg.platform] ?? 'bg-gray-100 text-gray-700'
                const isUnread = msg.action === 'flagged'
                return (
                  <div
                    key={msg.id}
                    onClick={() => { setSelected(msg); setReplyText('') }}
                    className={`p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${isUnread ? 'bg-amber-50/30' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 flex-shrink-0 text-base">
                      {senderLabel(msg).charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{senderLabel(msg)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${platClr}`}>{msg.platform}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${actCfg.color}`}>{actCfg.label}</span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{msg.message_text}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-400">{timeAgo(msg.created_at)}</span>
                        {msg.category === 'personal' && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">👤 Kibinafsi</span>
                        )}
                        <span className="text-xs text-gray-400">AI: {Math.round((msg.confidence ?? 0) * 100)}%</span>
                      </div>
                    </div>

                    {isUnread && (
                      <div className="w-3 h-3 bg-amber-500 rounded-full flex-shrink-0 mt-2 animate-pulse" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reply modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 text-base">{senderLabel(selected)}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selected.platform} · {timeAgo(selected.created_at)}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500"
                >
                  ✕
                </button>
              </div>

              {/* Original message */}
              <div className="bg-gray-100 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1 font-medium">Ujumbe wake:</p>
                <p className="text-sm text-gray-800 leading-relaxed">{selected.message_text}</p>
              </div>

              {/* AI reason */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-2">
                <span className="text-blue-500 flex-shrink-0">🤖</span>
                <div>
                  <p className="text-xs font-medium text-blue-700">Amina hakujibu kwa sababu:</p>
                  <p className="text-xs text-blue-600 mt-0.5">{selected.reason}</p>
                </div>
              </div>

              {/* Amina's auto-reply (if shown for context) */}
              {selected.action === 'auto_replied' && selected.auto_reply_sent && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-xs font-medium text-green-700 mb-1">🤖 Amina alijibu:</p>
                  <p className="text-sm text-green-800">{selected.auto_reply_sent}</p>
                </div>
              )}

              {/* Owner's past reply */}
              {selected.action === 'owner_replied' && selected.owner_reply && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                  <p className="text-xs font-medium text-primary-700 mb-1">✅ Jibu lako ({timeAgo(selected.owner_replied_at)}):</p>
                  <p className="text-sm text-primary-800">{selected.owner_reply}</p>
                </div>
              )}

              {/* Reply UI — only for flagged */}
              {selected.action === 'flagged' && (
                <>
                  {templates.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Jibu la haraka:</p>
                      <div className="flex gap-2 flex-wrap">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setReplyText(t.message)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Andika jibu lako hapa..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 resize-none"
                  />

                  <button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                  >
                    {sending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : '✉️'}
                    {sending ? 'Inatuma...' : 'Tuma Jibu'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
