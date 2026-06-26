'use client'
import { useState, useEffect, useCallback } from 'react'

type SpamStats = {
  totalDeleted: number
  totalHidden: number
  totalFlagged: number
  spamToday: number
  spamThisWeek: number
  topSpammer: string | null
  topKeyword: string | null
  recentSpam: SpamEntry[]
}

type SpamEntry = {
  id: string
  platform: 'instagram' | 'facebook'
  comment_id: string
  comment_text: string
  commenter_name: string | null
  action_taken: string
  spam_score: number
  created_at: string
}

type Keyword = {
  id: string
  keyword: string
  category: string
  is_active: boolean
  match_count: number
}

type Tab = 'stats' | 'keywords'

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    deleted: 'bg-red-100 text-red-700',
    hidden:  'bg-orange-100 text-orange-700',
    flagged: 'bg-yellow-100 text-yellow-700',
    ignored: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    deleted: 'Imefutwa', hidden: 'Imefichwa', flagged: 'Imewekwa Alama', ignored: 'Imepuuzwa',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[action] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[action] ?? action}
    </span>
  )
}

function PlatformIcon({ platform }: { platform: string }) {
  return platform === 'instagram'
    ? <span className="text-pink-500">📸</span>
    : <span className="text-blue-500">👤</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SpamTab() {
  const [innerTab, setInnerTab]     = useState<Tab>('stats')
  const [stats, setStats]           = useState<SpamStats | null>(null)
  const [keywords, setKeywords]     = useState<Keyword[]>([])
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [addingKw, setAddingKw]     = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/social/spam')
      const data = await res.json() as SpamStats
      setStats(data)
    } catch {
      showToast('Imeshindwa kupakia takwimu za spam')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadKeywords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/social/spam/keywords')
      const data = await res.json() as { keywords: Keyword[] }
      setKeywords(data.keywords ?? [])
    } catch {
      showToast('Imeshindwa kupakia maneno ya spam')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (innerTab === 'stats') loadStats()
    else loadKeywords()
  }, [innerTab, loadStats, loadKeywords])

  async function handleRestore(entry: SpamEntry) {
    setRestoringId(entry.id)
    try {
      const res = await fetch('/api/v1/social/spam', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spamId: entry.id,
          commentId: entry.comment_id,
          platform: entry.platform,
        }),
      })
      const data = await res.json() as { ok?: boolean }
      if (data.ok) {
        showToast('Maoni yamerudishwa kwa mafanikio')
        loadStats()
      }
    } catch {
      showToast('Imeshindwa kurejesha maoni')
    } finally {
      setRestoringId(null)
    }
  }

  async function handleAddKeyword() {
    if (!newKeyword.trim()) { showToast('Andika neno kwanza'); return }
    setAddingKw(true)
    try {
      const res = await fetch('/api/v1/social/spam/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim(), category: newCategory }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.error) { showToast(data.error); return }
      showToast(`"${newKeyword.trim()}" imeongezwa`)
      setNewKeyword('')
      loadKeywords()
    } finally {
      setAddingKw(false)
    }
  }

  async function handleToggleKeyword(kw: Keyword) {
    await fetch('/api/v1/social/spam/keywords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kw.id, isActive: !kw.is_active }),
    })
    setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, is_active: !k.is_active } : k))
  }

  async function handleDeleteKeyword(kw: Keyword) {
    await fetch('/api/v1/social/spam/keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: kw.id }),
    })
    setKeywords(prev => prev.filter(k => k.id !== kw.id))
    showToast(`"${kw.keyword}" imefutwa`)
  }

  const CATEGORIES = ['general', 'scam', 'competitor', 'adult', 'offensive']

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Inner tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setInnerTab('stats')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            innerTab === 'stats' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          📊 Takwimu za Spam
        </button>
        <button
          onClick={() => setInnerTab('keywords')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            innerTab === 'keywords' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🔑 Maneno ya Spam
        </button>
      </div>

      {/* ── STATS TAB ── */}
      {innerTab === 'stats' && (
        <div>
          {loading && !stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Imefutwa',      value: stats.totalDeleted,   emoji: '🗑️', color: 'text-red-600'    },
                  { label: 'Imefichwa',     value: stats.totalHidden,    emoji: '👁️', color: 'text-orange-600' },
                  { label: 'Imewekwa Alama', value: stats.totalFlagged,  emoji: '🚩', color: 'text-yellow-600' },
                  { label: 'Leo',           value: stats.spamToday,      emoji: '📅', color: 'text-blue-600'   },
                  { label: 'Wiki Hii',      value: stats.spamThisWeek,   emoji: '📆', color: 'text-purple-600' },
                  { label: 'Spam Yote',     value: stats.totalDeleted + stats.totalHidden + stats.totalFlagged, emoji: '⚠️', color: 'text-gray-700' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-2xl mb-1">{card.emoji}</div>
                    <div className={`text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Top stats */}
              {(stats.topSpammer || stats.topKeyword) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 space-y-1 text-sm">
                  {stats.topSpammer && (
                    <p>👤 <strong>Mspammer Mkubwa:</strong> {stats.topSpammer}</p>
                  )}
                  {stats.topKeyword && (
                    <p>🔑 <strong>Neno Linaloonekana Zaidi:</strong> {stats.topKeyword}</p>
                  )}
                </div>
              )}

              {/* Recent spam list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Spam ya Hivi Karibuni</h3>
                  <button
                    onClick={loadStats}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    🔄 Onyesha Upya
                  </button>
                </div>
                <div className="space-y-3">
                  {stats.recentSpam.map(entry => (
                    <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <PlatformIcon platform={entry.platform} />
                            <ActionBadge action={entry.action_taken} />
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Alama: {entry.spam_score}
                            </span>
                            <span className="text-xs text-gray-400">{fmtDate(entry.created_at)}</span>
                          </div>
                          {entry.commenter_name && (
                            <p className="text-xs font-medium text-gray-500">@{entry.commenter_name}</p>
                          )}
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">{entry.comment_text}</p>
                        </div>
                        {entry.action_taken !== 'ignored' && entry.action_taken !== 'deleted' && (
                          <button
                            onClick={() => handleRestore(entry)}
                            disabled={restoringId === entry.id}
                            className="flex-shrink-0 text-xs px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {restoringId === entry.id ? '...' : 'Rejesha'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stats.recentSpam.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-3">✅</div>
                      <p>Hakuna spam iliyogunduliwa hivi karibuni</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── KEYWORDS TAB ── */}
      {innerTab === 'keywords' && (
        <div>
          {/* Add new keyword */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
            <h3 className="font-semibold text-gray-800 mb-3">Ongeza Neno Jipya</h3>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                placeholder="neno la spam..."
                className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleAddKeyword}
                disabled={addingKw || !newKeyword.trim()}
                className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {addingKw ? '...' : '+ Ongeza'}
              </button>
            </div>
          </div>

          {/* Keywords list */}
          {loading && keywords.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const catKws = keywords.filter(k => k.category === cat)
                if (catKws.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">{cat}</p>
                    <div className="space-y-1.5">
                      {catKws.map(kw => (
                        <div key={kw.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${kw.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                              {kw.keyword}
                            </span>
                            {kw.match_count > 0 && (
                              <span className="ml-2 text-xs text-gray-400">({kw.match_count} mechi)</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleKeyword(kw)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                              kw.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {kw.is_active ? 'Washa' : 'Zima'}
                          </button>
                          <button
                            onClick={() => handleDeleteKeyword(kw)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Futa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {keywords.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">🔑</div>
                  <p>Hakuna maneno ya spam bado</p>
                  <p className="text-sm mt-1">Ongeza neno la kwanza hapo juu</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
