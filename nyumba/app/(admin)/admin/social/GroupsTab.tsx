'use client'
import { useState, useEffect } from 'react'

type Group = {
  id: string
  group_id: string
  group_name: string
  group_url: string | null
  members_count: number | null
  category: string | null
  is_active: boolean
  post_count: number
  last_posted_at: string | null
  notes: string | null
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Haijawahi'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60)  return `Dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `Masaa ${hrs} yaliyopita`
  return `Siku ${Math.floor(hrs / 24)} zilizopita`
}

export default function GroupsTab() {
  const [groups, setGroups]         = useState<Group[]>([])
  const [loading, setLoading]       = useState(true)
  const [posting, setPosting]       = useState<string | null>(null)  // group id being posted to
  const [postingAll, setPostingAll] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  // Add form state
  const [newGroupId, setNewGroupId]     = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupUrl, setNewGroupUrl]   = useState('')
  const [newMembers, setNewMembers]     = useState('')
  const [addLoading, setAddLoading]     = useState(false)

  // Post-to-groups listing selector
  const [listings, setListings]         = useState<{ id: string; title: string; district: string }[]>([])
  const [selectedListing, setSelectedListing] = useState('')

  function showMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function fetchGroups() {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/groups')
      const data = await res.json() as { groups?: Group[] }
      setGroups(data.groups ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchListings() {
    const res  = await fetch('/api/v1/listings?status=active&limit=50')
    const data = await res.json() as { listings?: { id: string; title: string; district: string; region: string }[] }
    setListings(
      (data.listings ?? []).map(l => ({ id: l.id, title: l.title, district: l.district }))
    )
  }

  useEffect(() => { fetchGroups(); fetchListings() }, [])

  async function handleToggle(group: Group) {
    await fetch(`/api/v1/social/groups/${group.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive: !group.is_active }),
    })
    showMsg(group.is_active ? `${group.group_name} imezimwa` : `${group.group_name} imewashwa`)
    fetchGroups()
  }

  async function handleDelete(group: Group) {
    if (!confirm(`Futa kundi "${group.group_name}"?`)) return
    await fetch(`/api/v1/social/groups/${group.id}`, { method: 'DELETE' })
    showMsg(`${group.group_name} imefutwa`)
    fetchGroups()
  }

  async function handlePostToGroup(group: Group) {
    if (!selectedListing) { showMsg('Chagua listing kwanza'); return }
    setPosting(group.group_id)
    try {
      const res  = await fetch('/api/v1/social/groups/post', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listingId: selectedListing, groupIds: [group.group_id] }),
      })
      const data = await res.json() as { ok?: boolean; posted?: number; error?: string }
      showMsg(data.ok ? `✅ Imechapishwa kwenye ${group.group_name}` : `❌ Imeshindwa: ${data.error}`)
      fetchGroups()
    } finally {
      setPosting(null)
    }
  }

  async function handlePostAll() {
    if (!selectedListing) { showMsg('Chagua listing kwanza'); return }
    setPostingAll(true)
    try {
      const res  = await fetch('/api/v1/social/groups/post', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listingId: selectedListing }),
      })
      const data = await res.json() as { ok?: boolean; posted?: number; total?: number; error?: string }
      showMsg(data.ok ? `✅ Machapisho ${data.posted}/${data.total} yamefanikiwa` : `❌ ${data.error}`)
      fetchGroups()
    } finally {
      setPostingAll(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupId.trim() || !newGroupName.trim()) {
      showMsg('Group ID na Jina vinahitajika')
      return
    }
    setAddLoading(true)
    try {
      const res  = await fetch('/api/v1/social/groups', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          groupId:      newGroupId.trim(),
          groupName:    newGroupName.trim(),
          groupUrl:     newGroupUrl.trim() || undefined,
          membersCount: newMembers ? parseInt(newMembers) : undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) { showMsg(`❌ ${data.error}`); return }
      showMsg(`✅ Kundi "${newGroupName}" limeongezwa!`)
      setNewGroupId(''); setNewGroupName(''); setNewGroupUrl(''); setNewMembers('')
      setShowAdd(false)
      fetchGroups()
    } finally {
      setAddLoading(false)
    }
  }

  const activeGroups   = groups.filter(g => g.is_active)
  const inactiveGroups = groups.filter(g => !g.is_active)

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">👥 Makundi ya Facebook</h2>
          <p className="text-sm text-gray-500">
            {activeGroups.length} hai · {inactiveGroups.length} imezimwa
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-xl hover:bg-[#178a65]"
        >
          + Ongeza Kundi
        </button>
      </div>

      {/* Add Group Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">➕ Ongeza Kundi la Facebook</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Facebook Group ID *
              </label>
              <input
                type="text"
                value={newGroupId}
                onChange={e => setNewGroupId(e.target.value)}
                placeholder="mfano: 1234567890"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Toa kutoka URL: facebook.com/groups/<strong>ID_HAPA</strong></p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jina la Kundi *</label>
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="mfano: Nyumba Tanzania"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">URL ya Kundi (hiari)</label>
              <input
                type="url"
                value={newGroupUrl}
                onChange={e => setNewGroupUrl(e.target.value)}
                placeholder="https://facebook.com/groups/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Wanachama (hiari)</label>
              <input
                type="number"
                value={newMembers}
                onChange={e => setNewMembers(e.target.value)}
                placeholder="mfano: 45000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={addLoading}
              className="px-6 py-2.5 bg-[#1D9E75] text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              {addLoading ? 'Inahifadhi...' : 'Hifadhi Kundi'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl"
            >
              Ghairi
            </button>
          </div>
        </form>
      )}

      {/* Listing selector + Post All */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-gray-600 block mb-1">Chagua Listing ya Kuchapisha</label>
          <select
            value={selectedListing}
            onChange={e => setSelectedListing(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          >
            <option value="">-- Chagua listing --</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title} — {l.district}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePostAll}
          disabled={postingAll || !selectedListing || activeGroups.length === 0}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {postingAll ? '⏳ Inachapisha...' : `🚀 Post kwenye Makundi Yote (${activeGroups.length})`}
        </button>
      </div>

      {/* Groups list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p>Hakuna makundi bado</p>
              <p className="text-sm mt-1">Ongeza kundi lako la kwanza la Facebook</p>
            </div>
          )}
          {groups.map(group => (
            <div
              key={group.id}
              className={`bg-white rounded-xl border p-4 ${group.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${group.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <p className="font-semibold text-gray-900 truncate">{group.group_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>ID: {group.group_id}</span>
                    {group.members_count && <span>👥 {group.members_count.toLocaleString()} wanachama</span>}
                    <span>📊 Posts: {group.post_count}</span>
                    <span>🕐 {timeAgo(group.last_posted_at)}</span>
                  </div>
                  {group.notes && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ {group.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(group)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                      group.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {group.is_active ? '🟢 Hai' : '⚫ Imezimwa'}
                  </button>
                  <button
                    onClick={() => handlePostToGroup(group)}
                    disabled={posting === group.group_id || !selectedListing || !group.is_active}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 disabled:opacity-40"
                  >
                    {posting === group.group_id ? '⏳' : '📤 Post'}
                  </button>
                  <button
                    onClick={() => handleDelete(group)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-medium rounded-lg hover:bg-red-200"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">⚠️ Jinsi ya kupata Group ID ya Facebook:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Fungua Facebook Group kwenye browser</li>
          <li>Angalia URL: <code className="bg-amber-100 px-1 rounded">facebook.com/groups/<strong>ID_HAPA</strong></code></li>
          <li>Nakili nambari au maandishi baada ya /groups/</li>
          <li>Kumbuka: NyumbaFasta inahitaji ruhusa ya kundi au kuwa admin wa kundi</li>
        </ol>
      </div>
    </div>
  )
}
