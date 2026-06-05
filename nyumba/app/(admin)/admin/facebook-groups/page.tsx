"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

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
      {/* Header */}
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10 shadow">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin" className="text-white text-sm">← Admin</Link>
        </div>
        <h1 className="text-white font-bold text-lg">👥 Facebook Groups</h1>
        <p className="text-green-100 text-xs">
          Groups: {groups.length} | Active: {activeCount}
        </p>
      </header>

      {/* Add new group */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="font-semibold text-sm mb-3">➕ Ongeza Group Mpya</p>

          <input
            type="url"
            placeholder="https://facebook.com/groups/..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
              focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <input
            type="text"
            placeholder="Jina la group (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
              focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <select
            value={newRegion}
            onChange={e => setNewRegion(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3
              focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

          <button
            onClick={addGroup}
            disabled={loading || !newUrl.trim()}
            className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold
              disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? 'Inaongeza...' : '➕ Ongeza Group'}
          </button>
        </div>
      </div>

      {/* Groups list */}
      <div className="px-4 space-y-3">
        {groups.map(group => (
          <div
            key={group.id}
            className={`bg-white rounded-2xl p-4 border shadow-sm ${
              group.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {group.name || group.url}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">📍 {group.region}</p>
                <a
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline break-all"
                >
                  {group.url.length > 50 ? group.url.slice(0, 50) + '...' : group.url}
                </a>
              </div>

              <div className="flex gap-2 ml-2 flex-shrink-0">
                <button
                  onClick={() => toggleGroup(group.id, group.is_active)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    group.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {group.is_active ? '✅ Active' : '⏸️ Paused'}
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-400 mt-2 border-t pt-2">
              <span>📝 Posts: {group.posts_found ?? 0}</span>
              <span>👤 Leads: {group.leads_found ?? 0}</span>
              {group.last_scraped_at && (
                <span>
                  🕐 {new Date(group.last_scraped_at).toLocaleDateString('sw-TZ')}
                </span>
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
  )
}
