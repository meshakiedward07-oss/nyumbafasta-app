'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type MissPattern = {
  text:          string
  count:         number
  layer:         string
  invoked_amina: boolean
}

type KBArticle = {
  id:         string
  slug:       string
  title:      string
  body:       string
  category:   string
  language:   string
  is_active:  boolean
  created_at: string
}

type Tab = 'patterns' | 'articles' | 'log'

type MissRow = {
  id:                  string
  message_text:        string
  layer_reached:       string
  best_cache_similarity: number | null
  best_kb_similarity:  number | null
  invoked_amina:       boolean
  reviewed:            boolean
  created_at:          string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  cache:          'bg-green-100 text-green-700',
  knowledge_base: 'bg-blue-100 text-blue-700',
  search:         'bg-purple-100 text-purple-700',
  action:         'bg-orange-100 text-orange-700',
  amina:          'bg-yellow-100 text-yellow-700',
  handover:       'bg-red-100 text-red-700',
}

function LayerBadge({ layer }: { layer: string }) {
  const cls = LAYER_COLORS[layer] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{layer}</span>
}

// ── Create / Edit Article Form ────────────────────────────────────────────────

function ArticleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<KBArticle & { prefill?: string }>
  onSave:   (article: KBArticle) => void
  onCancel: () => void
}) {
  const [title,    setTitle]    = useState(initial?.title    ?? '')
  const [body,     setBody]     = useState(initial?.body     ?? (initial?.prefill ? `Maswali yanayohusiana:\n"${initial.prefill}"\n\nJibu:\n` : ''))
  const [category, setCategory] = useState(initial?.category ?? 'general')
  const [slug,     setSlug]     = useState(initial?.slug     ?? '')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const isEdit = !!initial?.id

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const method = isEdit ? 'PATCH' : 'POST'
    const payload = isEdit
      ? { id: initial!.id, title, body, category, is_active: initial!.is_active ?? true }
      : { title, body, category, slug: slug || undefined }

    const res = await fetch('/api/v1/knowledge/articles', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Hitilafu')
      setLoading(false)
      return
    }
    onSave(data.article)
  }

  const categories = ['general','pricing','payments','registration','listings','contact_unlocks','account','search','support']

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kichwa (Title) *</label>
        <input
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Bei ya kufungua mawasiliano"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (optional — auto-generated)</label>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="e.g. bei-ya-kufungua (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Jibu / Mwili (Body) *</label>
        <textarea
          required
          rows={6}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Andika jibu kamili hapa. Amina atatumia hii moja kwa moja."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">
          Andika kwa Kiswahili. WhatsApp inaona *maneno* kwa bold na _maneno_ kwa italic.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kategoria</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Inahifadhi...' : isEdit ? 'Hifadhi Mabadiliko' : 'Unda Makala'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          Ghairi
        </button>
      </div>
    </form>
  )
}

// ── Miss Patterns Tab ─────────────────────────────────────────────────────────

function PatternsTab() {
  const [patterns,  setPatterns]  = useState<MissPattern[]>([])
  const [loading,   setLoading]   = useState(true)
  const [total,     setTotal]     = useState(0)
  const [creating,  setCreating]  = useState<string | null>(null)  // pattern text being turned into article
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/knowledge/misses?grouped=true')
    const data = await res.json()
    setPatterns(data.patterns ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function dismiss(text: string) {
    // Mark all misses with this prefix as reviewed (fire-and-forget via PATCH)
    setDismissed(prev => new Set(prev).add(text))
    // We can't efficiently bulk-PATCH by prefix from the client — just a visual dismiss for now.
    // The admin can use the raw log tab to bulk-review.
  }

  if (loading) return <div className="text-gray-500 py-8 text-center text-sm">Inapakia...</div>

  if (patterns.length === 0) return (
    <div className="text-center py-12 text-gray-500">
      <div className="text-4xl mb-2">🎉</div>
      <p className="font-medium">Hakuna mifumo ya kukosa jibu!</p>
      <p className="text-sm">Amina anajibu maswali yote bila msaada wa mwanaadamu.</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">Mifumo ya Kukosa Jibu</h2>
          <p className="text-sm text-gray-500">{total} miss hivi karibuni — bonyeza ili uunde makala mpya</p>
        </div>
        <button onClick={load} className="text-sm text-green-600 hover:underline">Onyesha upya</button>
      </div>

      {creating !== null && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-800 mb-3">
            Unda Makala Mpya <span className="font-normal text-green-600">kutoka miss hii</span>
          </h3>
          <ArticleForm
            initial={{ prefill: creating }}
            onSave={() => { setCreating(null); load() }}
            onCancel={() => setCreating(null)}
          />
        </div>
      )}

      <div className="space-y-3">
        {patterns
          .filter(p => !dismissed.has(p.text))
          .map((p, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg">
                {p.count}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">"{p.text}"</p>
                <div className="flex gap-2 mt-1">
                  <LayerBadge layer={p.layer} />
                  {p.invoked_amina && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Amina alishughulikia</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setCreating(p.text)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                >
                  + Makala
                </button>
                <button
                  onClick={() => dismiss(p.text)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  Puuza
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Knowledge Base Articles Tab ───────────────────────────────────────────────

function ArticlesTab() {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState<KBArticle | null>(null)
  const [creating, setCreating] = useState(false)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/knowledge/articles')
    const data = await res.json()
    setArticles(data.articles ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(article: KBArticle) {
    await fetch('/api/v1/knowledge/articles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: article.id, is_active: !article.is_active }),
    })
    setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_active: !a.is_active } : a))
  }

  const filtered = articles.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">Makala ya Maarifa</h2>
          <p className="text-sm text-gray-500">{articles.length} makala — {articles.filter(a => a.is_active).length} zinafanya kazi</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null) }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          + Makala Mpya
        </button>
      </div>

      {(creating || editing) && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-3">
            {editing ? 'Hariri Makala' : 'Unda Makala Mpya'}
          </h3>
          <ArticleForm
            initial={editing ?? undefined}
            onSave={(saved) => {
              if (editing) {
                setArticles(prev => prev.map(a => a.id === saved.id ? saved : a))
              } else {
                setArticles(prev => [saved, ...prev])
              }
              setEditing(null)
              setCreating(false)
            }}
            onCancel={() => { setEditing(null); setCreating(false) }}
          />
        </div>
      )}

      <div className="mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tafuta makala..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 py-8 text-center text-sm">Inapakia...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(article => (
            <div key={article.id} className={`bg-white border rounded-xl p-4 ${!article.is_active ? 'opacity-50' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-800 truncate">{article.title}</span>
                    <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">{article.category}</span>
                    {!article.is_active && <span className="text-xs text-red-500 px-2 py-0.5 bg-red-50 rounded">Imezimwa</span>}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{article.body}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setEditing(article); setCreating(false) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"
                  >
                    Hariri
                  </button>
                  <button
                    onClick={() => toggleActive(article)}
                    className={`px-3 py-1.5 rounded-lg text-xs ${article.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {article.is_active ? 'Zima' : 'Washa'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Hakuna makala {search ? 'zinazofanana na utafutaji wako' : 'bado'}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Raw Miss Log Tab ──────────────────────────────────────────────────────────

function MissLogTab() {
  const [misses,   setMisses]   = useState<MissRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [layer,    setLayer]    = useState('')
  const [reviewed, setReviewed] = useState('false')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100', reviewed })
    if (layer) params.set('layer', layer)
    const res = await fetch(`/api/v1/knowledge/misses?${params}`)
    const data = await res.json()
    setMisses(data.misses ?? [])
    setLoading(false)
  }, [layer, reviewed])

  useEffect(() => { load() }, [load])

  async function markReviewed(ids: string[]) {
    await fetch('/api/v1/knowledge/misses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setMisses(prev => prev.filter(m => !ids.includes(m.id)))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold text-gray-800">Miss Log</h2>

        <select
          value={layer}
          onChange={e => setLayer(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Safu zote</option>
          <option value="cache">cache</option>
          <option value="knowledge_base">knowledge_base</option>
          <option value="search">search</option>
          <option value="action">action</option>
        </select>

        <select
          value={reviewed}
          onChange={e => setReviewed(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="false">Hazijakaguliwa</option>
          <option value="true">Zilizokaguliwa</option>
        </select>

        <button onClick={load} className="text-sm text-green-600 hover:underline">Onyesha upya</button>

        {misses.length > 0 && reviewed === 'false' && (
          <button
            onClick={() => markReviewed(misses.map(m => m.id))}
            className="ml-auto px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"
          >
            Kagua zote ({misses.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500 py-8 text-center text-sm">Inapakia...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="pb-2 pr-3">Ujumbe</th>
                <th className="pb-2 pr-3">Safu</th>
                <th className="pb-2 pr-3">Cache sim</th>
                <th className="pb-2 pr-3">KB sim</th>
                <th className="pb-2 pr-3">Amina</th>
                <th className="pb-2">Tarehe</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {misses.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-3 max-w-xs">
                    <p className="text-gray-800 text-xs truncate">{m.message_text}</p>
                  </td>
                  <td className="py-2 pr-3"><LayerBadge layer={m.layer_reached} /></td>
                  <td className="py-2 pr-3 text-gray-500 font-mono text-xs">
                    {m.best_cache_similarity?.toFixed(2) ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-gray-500 font-mono text-xs">
                    {m.best_kb_similarity?.toFixed(2) ?? '—'}
                  </td>
                  <td className="py-2 pr-3">
                    {m.invoked_amina ? <span className="text-yellow-600 text-xs">✓</span> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('sw-TZ')}
                  </td>
                  <td className="py-2">
                    {!m.reviewed && (
                      <button
                        onClick={() => markReviewed([m.id])}
                        className="text-xs text-gray-500 hover:text-green-600"
                      >
                        ✓ Kagua
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {misses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">
                    Hakuna rekodi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Search Test Tab ───────────────────────────────────────────────────────────

function SearchTestTab() {
  const [query,   setQuery]   = useState('')
  const [result,  setResult]  = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  async function test() {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    const res  = await fetch(`/api/v1/knowledge/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-4">Jaribu Cascade</h2>
      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && test()}
          placeholder="Andika ujumbe kama wa WhatsApp..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={test}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Inajaribu...' : 'Jaribu'}
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className={`p-3 rounded-lg ${result.would_answer ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className={`font-semibold text-sm ${result.would_answer ? 'text-green-700' : 'text-yellow-700'}`}>
              {result.would_answer ? '✅ Cascade ingejibu' : '⚠️ Cascade haingejibu — Amina angeshughulika'}
            </p>
            {Boolean(result.layer_answered) && (
              <p className="text-xs mt-1">
                Safu: <LayerBadge layer={result.layer_answered as string} />
              </p>
            )}
          </div>

          {Boolean(result.cache_hit) && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-1">Cache hit — sim {String((result.cache_hit as Record<string,number>).similarity?.toFixed(3))}</p>
              <p className="text-sm text-gray-700">{String((result.cache_hit as Record<string,string>).answer ?? '')}</p>
            </div>
          )}

          {Boolean(result.fts_candidates) && Array.isArray(result.fts_candidates) && (result.fts_candidates as unknown[]).length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-2">FTS candidates ({(result.fts_candidates as unknown[]).length})</p>
              {(result.fts_candidates as Array<Record<string,string>>).slice(0, 3).map((c, i) => (
                <p key={i} className="text-xs text-gray-600 mb-1">• {c.title}</p>
              ))}
            </div>
          )}

          {Boolean(result.kb_result) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                KB winner — conf {String((result.kb_result as Record<string,number>).confidence?.toFixed(3))}
              </p>
              <p className="text-sm font-medium">{String((result.kb_result as Record<string,Record<string,string>>).candidate?.title ?? '')}</p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-3">{String((result.kb_result as Record<string,Record<string,string>>).candidate?.body ?? '')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>('patterns')

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'patterns', label: 'Miss Patterns', emoji: '🔍' },
    { id: 'articles', label: 'Makala',        emoji: '📚' },
    { id: 'log',      label: 'Miss Log',      emoji: '📋' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">🧠 Maarifa ya Amina</h1>
          <p className="text-sm text-gray-500 mt-1">
            Angalia mifumo ya maswali ambayo Amina haijaweza kujibu, kisha unda makala mpya ili ifundishwe.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
          <button
            onClick={() => setTab('patterns')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === ('search' as Tab)
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{ display: 'none' }}
          />
        </div>

        {/* Search test — always below tabs as a collapsible */}
        <SearchTestSection />

        {/* Tab content */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {tab === 'patterns' && <PatternsTab />}
          {tab === 'articles' && <ArticlesTab />}
          {tab === 'log'      && <MissLogTab />}
        </div>
      </div>
    </div>
  )
}

function SearchTestSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span>🧪 Jaribu Cascade (Preview)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4">
          <SearchTestTab />
        </div>
      )}
    </div>
  )
}
