'use client'
import { useEffect, useState } from 'react'
import { ORG_ROLE_LABELS } from '@/lib/types/property'
import type { OrganizationMember, OrgRole } from '@/lib/types/property'

const ROLES: { value: OrgRole; label: string }[] = [
  { value: 'branch_manager',          label: 'Meneja wa Tawi'       },
  { value: 'agent',                   label: 'Wakala'               },
  { value: 'maintenance_coordinator', label: 'Mratibu wa Matengenezo'},
  { value: 'accountant',              label: 'Mhasibu (Kusoma Tu)'  },
]

export default function TeamPage() {
  const [members,  setMembers]  = useState<OrganizationMember[]>([])
  const [loading,  setLoading]  = useState(true)
  const [orgId,    setOrgId]    = useState<string | null>(null)
  const [orgRole,  setOrgRole]  = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [phone,    setPhone]    = useState('')
  const [role,     setRole]     = useState<OrgRole>('agent')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/v1/organizations')
        const data = await res.json()
        if (!data.organizations?.length) return
        const primary = data.organizations.find((o: { role: string }) => o.role === 'owner') ?? data.organizations[0]
        setOrgId(primary.organization.id)
        setOrgRole(primary.role)
        const mRes  = await fetch(`/api/v1/organizations/${primary.organization.id}/members`)
        const mData = await mRes.json()
        setMembers(mData.members ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleAddMember() {
    if (!phone.trim() || !orgId) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setMembers(prev => [...prev, data.member])
      setShowForm(false)
      setPhone('')
    } catch {
      setError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setSaving(false) }
  }

  async function handleRemove(userId: string) {
    if (!orgId) return
    if (!confirm('Una uhakika unataka kuondoa mwanachama huyu?')) return
    await fetch(`/api/v1/organizations/${orgId}/members?user_id=${userId}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const canManage = orgRole === 'owner'

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timu Yangu</h1>
          <p className="text-sm text-gray-500">{members.length} wanachama</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-user-plus" aria-hidden="true" />
            <span>Alika Mwanachama</span>
          </button>
        )}
      </div>

      {/* Add member form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Ongeza Mwanachama Mpya</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nambari ya Simu (ya akaunti ya NyumbaFasta)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+255 7XX XXX XXX"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nafasi</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as OrgRole)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddMember}
                disabled={saving || !phone.trim()}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40"
              >
                {saving ? 'Inaoeza...' : 'Ongeza'}
              </button>
              <button onClick={() => { setShowForm(false); setError(null) }} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-users text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna wanachama wengine bado</p>
          <p className="text-sm text-gray-400 mt-1">Alika wafanyakazi au washirika kwenye shirika lako.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(m => {
            const u = m.user as unknown as { full_name: string; phone: string; email: string; avatar_url: string | null }
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                  {u?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt={u.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-primary-600 font-bold text-sm">
                      {u?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{u?.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-400">{u?.phone ?? u?.email ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    m.role === 'owner' ? 'bg-primary-50 text-primary-700' :
                    m.role === 'branch_manager' ? 'bg-blue-50 text-blue-700' :
                    m.role === 'accountant' ? 'bg-purple-50 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {ORG_ROLE_LABELS[m.role]}
                  </span>
                  {canManage && m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Ondoa mwanachama"
                    >
                      <i className="ti ti-user-minus text-sm" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
