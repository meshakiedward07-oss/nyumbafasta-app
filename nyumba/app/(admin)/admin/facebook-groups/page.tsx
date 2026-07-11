"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { PlatformLogo } from "@/components/shared/PlatformLogo"

// ── Types ──────────────────────────────────────────────────────────────────
type FbGroup = {
  id: string
  url: string
  name: string | null
  region: string | null
  is_active: boolean
  last_scraped_at: string | null
  posts_found: number
  leads_found: number
  created_at: string
}

type PostingGroup = {
  id: string
  group_id: string
  group_name: string
  group_url: string | null
  category: string | null
  is_active: boolean
  post_count: number
  last_posted_at: string | null
  notes: string | null
  created_at: string
}

type ExtractResult = {
  group_id?: string
  group_url?: string
  is_numeric_id?: boolean
  error?: string
  resolved_url?: string
}

const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma',
  'Zanzibar Mjini Magharibi', 'Mbeya', 'Tanga',
  'Morogoro', 'Kilimanjaro', 'Zote Tanzania',
]

// ── URL helpers ─────────────────────────────────────────────────────────────
function isFacebookGroupUrl(url: string): boolean {
  return /facebook\.com\/(groups|share\/g)|fb\.me\/(g|e)\//.test(url)
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FacebookGroupsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'scraping' | 'posting'>('posting')

  // ── Scraping-groups state ──────────────────────────────────────────────
  const [groups, setGroups] = useState<FbGroup[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newRegion, setNewRegion] = useState('Dar es Salaam')
  const [addingLead, setAddingLead] = useState(false)
  const [leadError, setLeadError] = useState('')

  // ── Posting-groups state ───────────────────────────────────────────────
  const [postingGroups, setPostingGroups] = useState<PostingGroup[]>([])
  const [pastedUrl, setPastedUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractResult | null>(null)
  const [editedName, setEditedName] = useState('')
  const [editedCategory, setEditedCategory] = useState('nyumba')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Data fetchers ──────────────────────────────────────────────────────
  const fetchLeadGroups = useCallback(async () => {
    const { data } = await supabase
      .from('facebook_groups')
      .select('*')
      .order('created_at', { ascending: false })
    setGroups((data as FbGroup[]) || [])
  }, [supabase])

  const fetchPostingGroups = useCallback(async () => {
    const res = await fetch('/api/v1/admin/fb-posting-groups')
    if (res.ok) setPostingGroups(await res.json())
  }, [])

  useEffect(() => { fetchLeadGroups(); fetchPostingGroups() }, [fetchLeadGroups, fetchPostingGroups])

  // ── Auto-extract when a valid Facebook URL is pasted ──────────────────
  useEffect(() => {
    setExtracted(null)
    setSaveError('')
    setSaveSuccess('')
    if (!pastedUrl.trim() || !isFacebookGroupUrl(pastedUrl)) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setExtracting(true)
      try {
        const res = await fetch('/api/v1/admin/facebook-groups/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pastedUrl.trim() }),
        })
        const data = await res.json() as ExtractResult
        setExtracted(data)
        if (data.group_id && !data.error) {
          // Pre-fill name: use URL slug if readable, else generic "Facebook Group"
          const isNumeric = /^\d+$/.test(data.group_id)
          const autoName = isNumeric
            ? 'Facebook Group'
            : data.group_id.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          setEditedName(prev => prev || autoName)
        }
      } catch {
        setExtracted({ error: 'Imeshindwa kuunganika. Angalia mtandao wako.' })
      } finally {
        setExtracting(false)
      }
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [pastedUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save 1.5s after extract succeeds (true autosave) ─────────────
  useEffect(() => {
    if (!extracted?.group_id || extracted.error || !editedName.trim()) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      savePostingGroup()
    }, 1500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [extracted, editedName]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save posting group ─────────────────────────────────────────────────
  async function savePostingGroup() {
    if (!extracted?.group_id || !editedName.trim()) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    try {
      const res = await fetch('/api/v1/admin/fb-posting-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id:   extracted.group_id,
          group_name: editedName.trim(),
          group_url:  extracted.group_url ?? '',
          category:   editedCategory,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? 'Imeshindwa kuhifadhi'); return }
      setSaveSuccess(`Group "${editedName}" imehifadhiwa!`)
      setPastedUrl('')
      setExtracted(null)
      setEditedName('')
      fetchPostingGroups()
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle posting group active ────────────────────────────────────────
  async function togglePosting(g: PostingGroup) {
    await fetch('/api/v1/admin/fb-posting-groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id, is_active: !g.is_active }),
    })
    fetchPostingGroups()
  }

  async function deletePosting(g: PostingGroup) {
    if (!confirm(`Futa "${g.group_name}"?`)) return
    await fetch('/api/v1/admin/fb-posting-groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id }),
    })
    fetchPostingGroups()
  }

  // ── Lead group actions ─────────────────────────────────────────────────
  async function addLeadGroup() {
    if (!newUrl.trim()) return
    setAddingLead(true); setLeadError('')
    try {
      const { error: err } = await supabase.from('facebook_groups').insert({
        url: newUrl.trim(),
        name: newName.trim() || newUrl.trim(),
        region: newRegion,
        is_active: true,
      })
      if (err) { setLeadError(err.message); return }
      setNewUrl(''); setNewName('')
      fetchLeadGroups()
    } finally {
      setAddingLead(false)
    }
  }

  async function toggleLeadGroup(id: string, isActive: boolean) {
    await supabase.from('facebook_groups').update({ is_active: !isActive }).eq('id', id)
    fetchLeadGroups()
  }

  async function deleteLeadGroup(id: string) {
    if (!confirm('Una uhakika wa kufuta group hii?')) return
    await supabase.from('facebook_groups').delete().eq('id', id)
    fetchLeadGroups()
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const activePostingCount = postingGroups.filter(g => g.is_active).length
  const activeLeadCount    = groups.filter(g => g.is_active).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── Mobile Header ── */}
      <header className="lg:hidden bg-[#1877F2] px-4 py-4 sticky top-0 z-10 shadow">
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <PlatformLogo platform="facebook" size={22} />
          Facebook Groups
        </h1>
        <p className="text-blue-100 text-xs mt-0.5">
          Auto-Post: {activePostingCount} active · Scraping: {activeLeadCount} active
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">

        {/* ── Desktop Title ── */}
        <div className="hidden lg:flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PlatformLogo platform="facebook" size={26} />
              Facebook Groups
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Auto-Post: <strong>{activePostingCount}</strong> vikundi · Scraping: <strong>{activeLeadCount}</strong> vikundi
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
          <button
            onClick={() => setActiveTab('posting')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'posting'
                ? 'bg-white text-[#1877F2] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ti ti-send mr-1" aria-hidden="true" />
            Auto-Post ({postingGroups.length})
          </button>
          <button
            onClick={() => setActiveTab('scraping')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'scraping'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ti ti-search mr-1" aria-hidden="true" />
            Lead Hunting ({groups.length})
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════
            TAB: AUTO-POST GROUPS
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'posting' && (
          <div className="space-y-4">

            {/* Smart link extractor */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-bold text-sm text-gray-800 mb-1 flex items-center gap-2">
                <i className="ti ti-link text-[#1877F2]" aria-hidden="true" />
                Weka Link ya Group
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Weka link yoyote ya Facebook group — share link, m.facebook.com, au URL ya kawaida.
                System itachimba group ID na URL halisi kiotomatiki.
              </p>

              <div className="relative">
                <input
                  type="url"
                  placeholder="Bandika link hapa… https://www.facebook.com/share/g/... au /groups/..."
                  value={pastedUrl}
                  onChange={e => setPastedUrl(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                    extracted?.error
                      ? 'border-red-300 focus:ring-red-300'
                      : extracted?.group_id
                      ? 'border-green-400 focus:ring-green-300'
                      : 'border-gray-200 focus:ring-[#1877F2]/40'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
                  {extracting
                    ? <span className="inline-block animate-spin text-gray-400">⟳</span>
                    : extracted?.group_id
                    ? <span className="text-green-500">✓</span>
                    : extracted?.error
                    ? <span className="text-red-400">✗</span>
                    : <span className="text-gray-300"><i className="ti ti-link" /></span>
                  }
                </span>
              </div>

              {extracting && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <span className="inline-block animate-spin">⟳</span>
                  Inachimba link…
                </p>
              )}

              {/* Error state */}
              {extracted?.error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-600 font-medium">{extracted.error}</p>
                  {extracted.resolved_url && (
                    <p className="text-xs text-gray-500 mt-1 break-all">
                      Link iliyopatikana: <a href={extracted.resolved_url} target="_blank" rel="noopener noreferrer" className="underline">{extracted.resolved_url}</a>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Jaribu kubandika URL ya kawaida ya group moja kwa moja, k.m.:<br/>
                    <code className="font-mono bg-gray-100 px-1 rounded">https://www.facebook.com/groups/123456789</code>
                  </p>
                </div>
              )}

              {/* Extracted preview + save form */}
              {extracted?.group_id && !extracted.error && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                      <PlatformLogo platform="facebook" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Imechimba ✓</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-blue-700">
                        <span className="font-medium">Group ID</span>
                        <code className="font-mono bg-white/60 px-1 rounded text-blue-900">{extracted.group_id}</code>
                        <span className="font-medium">URL</span>
                        <a href={extracted.group_url} target="_blank" rel="noopener noreferrer"
                          className="underline truncate">{extracted.group_url}</a>
                        {extracted.is_numeric_id === false && (
                          <>
                            <span className="font-medium col-span-2 text-amber-600 mt-1">
                              ⚠ ID ni slug (si nambari). Facebook API inaweza kuhitaji nambari halisi.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Name + category inputs */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Jina la group (lazima)"
                      value={editedName}
                      onChange={e => setEditedName(e.target.value)}
                      className="w-full border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editedCategory}
                        onChange={e => setEditedCategory(e.target.value)}
                        className="flex-1 border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      >
                        <option value="nyumba">Nyumba &amp; Vyumba</option>
                        <option value="biashara">Biashara</option>
                        <option value="general">Jumla (General)</option>
                      </select>
                      <button
                        onClick={savePostingGroup}
                        disabled={saving || !editedName.trim()}
                        className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-sm font-bold
                          disabled:opacity-50 hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        {saving ? (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Inahifadhi…
                          </span>
                        ) : 'Hifadhi Group'}
                      </button>
                    </div>
                  </div>

                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                </div>
              )}

              {saveSuccess && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <p className="text-sm text-green-700 font-medium">{saveSuccess}</p>
                </div>
              )}
            </div>

            {/* Posting groups list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-sm text-gray-800">
                  Vikundi vya Auto-Post
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {activePostingCount}/{postingGroups.length} active
                  </span>
                </p>
              </div>

              {postingGroups.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-5xl mb-3 flex justify-center opacity-40">
                    <PlatformLogo platform="facebook" size={44} />
                  </div>
                  <p className="text-gray-500 font-medium text-sm">Hakuna vikundi bado</p>
                  <p className="text-gray-400 text-xs mt-1">Bandika link ya group hapo juu uanze</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {postingGroups.map(g => (
                    <div key={g.id} className={`px-5 py-4 flex items-start gap-3 ${!g.is_active ? 'opacity-50' : ''}`}>
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <PlatformLogo platform="facebook" size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 truncate">{g.group_name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            g.category === 'nyumba' ? 'bg-green-100 text-green-700'
                            : g.category === 'biashara' ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {g.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          <code className="font-mono bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">{g.group_id}</code>
                          {g.group_url && (
                            <a href={g.group_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-500 hover:underline truncate max-w-[160px]">
                              Fungua Group ↗
                            </a>
                          )}
                          {g.last_posted_at && (
                            <span>
                              Mwisho: {new Date(g.last_posted_at).toLocaleDateString('sw-TZ')}
                            </span>
                          )}
                          <span>Posts: <strong>{g.post_count}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => togglePosting(g)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                            g.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {g.is_active ? 'Active' : 'Paused'}
                        </button>
                        <button
                          onClick={() => deletePosting(g)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Futa"
                        >
                          <i className="ti ti-trash text-sm" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: LEAD HUNTING (scraping groups — existing feature)
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'scraping' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-1">
                <i className="ti ti-search" aria-hidden="true" />
                Ongeza Group ya Lead Hunting
              </p>
              <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3">
                <input
                  type="url"
                  placeholder="https://facebook.com/groups/..."
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  placeholder="Jina la group (optional)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <select
                    value={newRegion}
                    onChange={e => setNewRegion(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    onClick={addLeadGroup}
                    disabled={addingLead || !newUrl.trim()}
                    className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary-600"
                  >
                    <i className="ti ti-plus" aria-hidden="true" /> Ongeza
                  </button>
                </div>
              </div>
              {leadError && <p className="text-red-500 text-xs mt-2">{leadError}</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Group', 'URL', 'Mkoa', 'Posts', 'Leads', 'Mwisho Scraped', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.map(group => (
                      <tr key={group.id} className={`hover:bg-gray-50 ${!group.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm text-gray-900">{group.name || 'Haijawekwa'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <a href={group.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline max-w-xs truncate block">
                            {group.url.length > 40 ? group.url.slice(0, 40) + '…' : group.url}
                          </a>
                        </td>
                        <td className="px-4 py-3"><span className="text-sm text-gray-600">{group.region || '—'}</span></td>
                        <td className="px-4 py-3"><span className="text-sm font-medium">{group.posts_found || 0}</span></td>
                        <td className="px-4 py-3"><span className="text-sm font-medium text-primary-500">{group.leads_found || 0}</span></td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">
                            {group.last_scraped_at ? new Date(group.last_scraped_at).toLocaleDateString('sw-TZ') : 'Haijawahi'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleLeadGroup(group.id, group.is_active)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium ${group.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {group.is_active ? 'Active' : 'Paused'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteLeadGroup(group.id)}
                            className="text-red-400 hover:text-red-600 text-sm p-1 rounded-lg hover:bg-red-50">
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {groups.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-gray-400">
                          <div className="flex justify-center mb-3 opacity-40">
                            <PlatformLogo platform="facebook" size={40} />
                          </div>
                          <p className="font-medium text-sm">Hakuna groups bado</p>
                          <p className="text-xs mt-1">Ongeza group ya kwanza hapo juu</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
