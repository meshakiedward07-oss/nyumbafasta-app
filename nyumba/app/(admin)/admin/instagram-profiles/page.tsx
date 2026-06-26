"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

type IgProfile = {
  id: string
  url: string
  username: string | null
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

export default function InstagramProfilesPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<IgProfile[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newRegion, setNewRegion] = useState('Dar es Salaam')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('instagram_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles((data as IgProfile[]) || [])
  }, [supabase])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  async function addProfile() {
    if (!newUrl.trim()) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('instagram_profiles').insert({
        url: newUrl.trim(),
        username: newUsername.trim() || newUrl.trim().replace('https://www.instagram.com/', '').replace('/', ''),
        region: newRegion,
        is_active: true,
      })
      if (err) { setError(err.message); return }
      setNewUrl('')
      setNewUsername('')
      fetchProfiles()
    } finally {
      setLoading(false)
    }
  }

  async function toggleProfile(id: string, isActive: boolean) {
    await supabase.from('instagram_profiles').update({ is_active: !isActive }).eq('id', id)
    fetchProfiles()
  }

  async function deleteProfile(id: string) {
    if (!confirm('Una uhakika wa kufuta profile hii?')) return
    await supabase.from('instagram_profiles').delete().eq('id', id)
    fetchProfiles()
  }

  const activeCount = profiles.filter(p => p.is_active).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ════════════════════════════════
          DESKTOP VIEW
      ════════════════════════════════ */}
      <div className="hidden lg:block p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📸 Instagram Profiles</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Profiles: {profiles.length} · Active: {activeCount}
            </p>
          </div>
        </div>

        {/* Add form inline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <p className="font-semibold text-sm text-gray-800 mb-4">➕ Ongeza Profile Mpya</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="url"
              placeholder="https://www.instagram.com/username"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              placeholder="Username (optional)"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
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
                onClick={addProfile}
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

        {/* Profiles table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Username', 'URL', 'Mkoa', 'Posts', 'Leads', 'Mwisho Scraped', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map(profile => (
                <tr key={profile.id} className={`hover:bg-gray-50 ${!profile.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-gray-900">@{profile.username || 'Haijawekwa'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a href={profile.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline max-w-xs truncate block">
                      {profile.url.length > 45 ? profile.url.slice(0, 45) + '...' : profile.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{profile.region || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">{profile.posts_found || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-primary-500">{profile.leads_found || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">
                      {profile.last_scraped_at
                        ? new Date(profile.last_scraped_at).toLocaleDateString('sw-TZ')
                        : 'Haijawahi'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleProfile(profile.id, profile.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                        profile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {profile.is_active ? '✅ Active' : '⏸️ Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteProfile(profile.id)}
                      className="text-red-400 hover:text-red-600 text-sm p-1 rounded-lg hover:bg-red-50"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">📸</div>
                    <p className="font-medium">Hakuna profiles bado</p>
                    <p className="text-sm mt-1">Ongeza profile ya kwanza hapo juu</p>
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
          <h1 className="text-white font-bold text-lg">📸 Instagram Profiles</h1>
          <p className="text-green-100 text-xs">
            Profiles: {profiles.length} | Active: {activeCount}
          </p>
        </header>

        {/* Add new profile */}
        <div className="px-4 py-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="font-semibold text-sm mb-3">➕ Ongeza Profile Mpya</p>
            <input type="url" placeholder="https://www.instagram.com/username"
              value={newUrl} onChange={e => setNewUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input type="text" placeholder="Username (optional — itatokana na URL)"
              value={newUsername} onChange={e => setNewUsername(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select value={newRegion} onChange={e => setNewRegion(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3
                focus:outline-none focus:ring-2 focus:ring-primary-500">
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <button onClick={addProfile} disabled={loading || !newUrl.trim()}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold
                disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Inaongeza...' : '➕ Ongeza Profile'}
            </button>
          </div>
        </div>

        {/* Profiles list */}
        <div className="px-4 space-y-3">
          {profiles.map(profile => (
            <div key={profile.id}
              className={`bg-white rounded-2xl p-4 border shadow-sm ${
                profile.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">@{profile.username || profile.url}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📍 {profile.region}</p>
                  <a href={profile.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 underline break-all">
                    {profile.url.length > 50 ? profile.url.slice(0, 50) + '...' : profile.url}
                  </a>
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button onClick={() => toggleProfile(profile.id, profile.is_active)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      profile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {profile.is_active ? '✅ Active' : '⏸️ Paused'}
                  </button>
                  <button onClick={() => deleteProfile(profile.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-400 mt-2 border-t pt-2">
                <span>📝 Posts: {profile.posts_found ?? 0}</span>
                <span>👤 Leads: {profile.leads_found ?? 0}</span>
                {profile.last_scraped_at && (
                  <span>🕐 {new Date(profile.last_scraped_at).toLocaleDateString('sw-TZ')}</span>
                )}
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📸</div>
              <p className="text-gray-500 font-medium">Hakuna profiles bado</p>
              <p className="text-gray-400 text-sm mt-1">Ongeza profile ya kwanza hapo juu!</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
