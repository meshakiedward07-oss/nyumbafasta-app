"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

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

const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma',
  'Zanzibar Mjini Magharibi', 'Mbeya', 'Tanga',
  'Morogoro', 'Kilimanjaro', 'Zote Tanzania',
]

export default function FacebookGroupsPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<FbGroup[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newRegion, setNewRegion] = useState('Dar es Salaam')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase
      .from('facebook_groups')
      .select('*')
      .order('created_at', { ascending: false })
    setGroups((data as FbGroup[]) || [])
  }, [supabase])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  async function addGroup() {
    if (!newUrl.trim()) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('facebook_groups').insert({
        url: newUrl.trim(),
        name: newName.trim() || newUrl.trim(),
        region: newRegion,
        is_active: true,
      })
      if (err) { setError(err.message); return }
      setNewUrl('')
      setNewName('')
      fetchGroups()
    } finally {
      setLoading(false)
    }
  }

  async function toggleGroup(id: string, isActive: boolean) {
    await supabase.from('facebook_groups').update({ is_active: !isActive }).eq('id', id)
    fetchGroups()
  }

  async function deleteGroup(id: string) {
    if (!confirm('Una uhakika wa kufuta group hii?')) return
    await supabase.from('facebook_groups').delete().eq('id', id)
    fetchGroups()
  }

  const activeCount = groups.filter(g => g.is_active).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ════════════════════════════════
          DESKTOP VIEW
      ════════════════════════════════ */}
      <div className="hidden lg:block p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 Facebook Groups</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Groups: {groups.length} · Active: {activeCount}
            </p>
          </div>
        </div>

        {/* Add form inline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <p className="font-semibold text-sm text-gray-800 mb-4">➕ Ongeza Group Mpya</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="url"
              placeholder="https://facebook.com/groups/..."
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              placeholder="Jina la group (optional)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                onClick={addGroup}
                disabled={loading || !newUrl.trim()}
                className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-bold
                  disabled:opacity-50 whitespace-nowrap hover:bg-primary-600"
              >
                ➕ Ongeza
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        {/* Groups table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Group', 'URL', 'Mkoa', 'Posts', 'Leads', 'Mwisho Scraped', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(group => (
                <tr key={group.id} className={`hover:bg-gray-50 ${!group.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-gray-900">{group.name || 'Haijawekwa'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a href={group.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline max-w-xs truncate block">
                      {group.url.length > 45 ? group.url.slice(0, 45) + '...' : group.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{group.region || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">{group.posts_found || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-primary-500">{group.leads_found || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">
                      {group.last_scraped_at
                        ? new Date(group.last_scraped_at).toLocaleDateString('sw-TZ')
                        : 'Haijawahi'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleGroup(group.id, group.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                        group.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {group.is_active ? '✅ Active' : '⏸️ Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="text-red-400 hover:text-red-600 text-sm p-1 rounded-lg hover:bg-red-50"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="font-medium">Hakuna groups bado</p>
                    <p className="text-sm mt-1">Ongeza group ya kwanza hapo juu</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          MOBILE VIEW
      ════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Header */}
        <header className="bg-primary-500 px-4 py-4 sticky top-0 z-10 shadow">
          <h1 className="text-white font-bold text-lg">👥 Facebook Groups</h1>
          <p className="text-green-100 text-xs">
            Groups: {groups.length} | Active: {activeCount}
          </p>
        </header>

        {/* Add new group */}
        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="font-semibold text-sm mb-3">➕ Ongeza Group Mpya</p>
            <input type="url" placeholder="https://facebook.com/groups/..."
              value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input type="text" placeholder="Jina la group (optional)"
              value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select value={newRegion} onChange={e => setNewRegion(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3
                focus:outline-none focus:ring-2 focus:ring-primary-500">
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <button onClick={addGroup} disabled={loading || !newUrl.trim()}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold
                disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Inaongeza...' : '➕ Ongeza Group'}
            </button>
          </div>
        </div>

        {/* Groups list */}
        <div className="px-4 space-y-3">
          {groups.map(group => (
            <div key={group.id}
              className={`bg-white rounded-2xl p-4 border shadow-sm ${
                group.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{group.name || group.url}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📍 {group.region}</p>
                  <a href={group.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 underline break-all">
                    {group.url.length > 50 ? group.url.slice(0, 50) + '...' : group.url}
                  </a>
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button onClick={() => toggleGroup(group.id, group.is_active)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      group.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {group.is_active ? '✅ Active' : '⏸️ Paused'}
                  </button>
                  <button onClick={() => deleteGroup(group.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-400 mt-2 border-t pt-2">
                <span>📝 Posts: {group.posts_found ?? 0}</span>
                <span>👤 Leads: {group.leads_found ?? 0}</span>
                {group.last_scraped_at && (
                  <span>🕐 {new Date(group.last_scraped_at).toLocaleDateString('sw-TZ')}</span>
                )}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">👥</div>
              <p className="text-gray-500 font-medium">Hakuna groups bado</p>
              <p className="text-gray-400 text-sm mt-1">Ongeza group ya kwanza hapo juu!</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
