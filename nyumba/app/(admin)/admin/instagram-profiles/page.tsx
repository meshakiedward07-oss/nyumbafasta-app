"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

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
      {/* Header */}
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10 shadow">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin" className="text-white text-sm">← Admin</Link>
        </div>
        <h1 className="text-white font-bold text-lg">📸 Instagram Profiles</h1>
        <p className="text-green-100 text-xs">
          Profiles: {profiles.length} | Active: {activeCount}
        </p>
      </header>

      {/* Add new profile */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="font-semibold text-sm mb-3">➕ Ongeza Profile Mpya</p>

          <input
            type="url"
            placeholder="https://www.instagram.com/username"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2
              focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <input
            type="text"
            placeholder="Username (optional — itatokana na URL)"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
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
            onClick={addProfile}
            disabled={loading || !newUrl.trim()}
            className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold
              disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? 'Inaongeza...' : '➕ Ongeza Profile'}
          </button>
        </div>
      </div>

      {/* Profiles list */}
      <div className="px-4 space-y-3">
        {profiles.map(profile => (
          <div
            key={profile.id}
            className={`bg-white rounded-2xl p-4 border shadow-sm ${
              profile.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  @{profile.username || profile.url}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">📍 {profile.region}</p>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline break-all"
                >
                  {profile.url.length > 50 ? profile.url.slice(0, 50) + '...' : profile.url}
                </a>
              </div>

              <div className="flex gap-2 ml-2 flex-shrink-0">
                <button
                  onClick={() => toggleProfile(profile.id, profile.is_active)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    profile.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {profile.is_active ? '✅ Active' : '⏸️ Paused'}
                </button>
                <button
                  onClick={() => deleteProfile(profile.id)}
                  className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-400 mt-2 border-t pt-2">
              <span>📝 Posts: {profile.posts_found ?? 0}</span>
              <span>👤 Leads: {profile.leads_found ?? 0}</span>
              {profile.last_scraped_at && (
                <span>
                  🕐 {new Date(profile.last_scraped_at).toLocaleDateString('sw-TZ')}
                </span>
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
  )
}
