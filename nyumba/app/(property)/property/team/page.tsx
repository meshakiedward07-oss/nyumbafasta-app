'use client'
import { useEffect, useState, useRef } from 'react'
import { ORG_ROLE_LABELS } from '@/lib/types/property'
import type { OrganizationMember, OrgRole } from '@/lib/types/property'

const ASSIGNABLE_ROLES: { value: OrgRole; label: string }[] = [
  { value: 'branch_manager',          label: 'Meneja wa Tawi'         },
  { value: 'agent',                   label: 'Wakala'                 },
  { value: 'maintenance_coordinator', label: 'Mratibu wa Matengenezo' },
  { value: 'accountant',              label: 'Mhasibu'                },
]

function roleBadgeClass(role: OrgRole) {
  if (role === 'owner')          return 'bg-primary-50 text-primary-700'
  if (role === 'branch_manager') return 'bg-blue-50 text-blue-700'
  if (role === 'accountant')     return 'bg-purple-50 text-purple-700'
  return 'bg-gray-100 text-gray-600'
}

function RoleEditor({ member, orgId, onUpdated }: {
  member: OrganizationMember
  orgId: string
  onUpdated: (m: OrganizationMember) => void
}) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function changeRole(newRole: OrgRole) {
    setOpen(false)
    setSaving(true)
    const res  = await fetch(`/api/v1/organizations/${orgId}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json()
    if (res.ok) onUpdated({ ...member, role: data.member.role })
    setSaving(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        disabled={saving}
        className={`text-xs px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1 ${roleBadgeClass(member.role)} hover:opacity-80 ${saving ? 'opacity-50' : ''}`}
      >
        {saving ? '...' : ORG_ROLE_LABELS[member.role]}
        <i className="ti ti-chevron-down text-[10px]" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[200px]">
          {ASSIGNABLE_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => changeRole(r.value)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl ${
                r.value === member.role ? 'text-primary-600 font-semibold' : 'text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TransferModal({ members, orgId, onDone, onClose }: {
  members: OrganizationMember[]
  orgId: string
  onDone: () => void
  onClose: () => void
}) {
  const eligible   = members.filter(m => m.role !== 'owner')
  const [newId,    setNewId]   = useState(eligible[0]?.user_id ?? '')
  const [prevRole, setPrevRole] = useState<OrgRole>('branch_manager')
  const [saving,   setSaving]  = useState(false)
  const [error,    setError]   = useState<string | null>(null)

  async function submit() {
    if (!newId) return
    setSaving(true); setError(null)
    const res  = await fetch(`/api/v1/organizations/${orgId}/transfer-ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_owner_user_id: newId, previous_owner_role: prevRole }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); setSaving(false); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Hamisha Umiliki wa Shirika</h2>
        <p className="text-sm text-gray-500 mb-4">Hatua hii ni ya kudumu. Mwenye mpya atakuwa na mamlaka kamili ya shirika.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Mwenye Mpya</label>
            <select
              value={newId}
              onChange={e => setNewId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {eligible.map(m => {
                const u = m.user as unknown as { full_name: string | null }
                return <option key={m.user_id} value={m.user_id}>{u?.full_name ?? m.user_id}</option>
              })}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nafasi yako baada ya kuhamisha</label>
            <select
              value={prevRole}
              onChange={e => setPrevRole(e.target.value as OrgRole)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={submit}
              disabled={saving || !newId}
              className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
            >
              {saving ? 'Inahamisha...' : 'Hamisha Umiliki'}
            </button>
            <button onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              Ghairi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const [members,      setMembers]      = useState<OrganizationMember[]>([])
  const [loading,      setLoading]      = useState(true)
  const [orgId,        setOrgId]        = useState<string | null>(null)
  const [myUserId,     setMyUserId]     = useState<string | null>(null)
  const [orgRole,      setOrgRole]      = useState<string | null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [lookup,       setLookup]       = useState('')
  const [inviteRole,   setInviteRole]   = useState<OrgRole>('agent')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [orgRes, meRes] = await Promise.all([
          fetch('/api/v1/organizations'),
          fetch('/api/v1/auth/me'),
        ])
        const [orgData, meData] = await Promise.all([orgRes.json(), meRes.json()])
        setMyUserId(meData.user?.id ?? null)
        if (!orgData.organizations?.length) return
        const primary = orgData.organizations.find((o: { role: string }) => o.role === 'owner') ?? orgData.organizations[0]
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

  async function handleInvite() {
    if (!lookup.trim() || !orgId) return
    setSaving(true); setError(null)
    const isEmail = lookup.includes('@')
    const body = isEmail
      ? { email: lookup.trim(), role: inviteRole }
      : { phone: lookup.trim(), role: inviteRole }
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setMembers(prev => [...prev, data.member])
      setShowForm(false); setLookup('')
    } catch { setError('Haikuweza kuunganika. Jaribu tena.') }
    finally { setSaving(false) }
  }

  async function handleRemove(userId: string) {
    if (!orgId) return
    if (!confirm('Una uhakika unataka kuondoa mwanachama huyu?')) return
    await fetch(`/api/v1/organizations/${orgId}/members?user_id=${userId}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  function handleMemberUpdated(updated: OrganizationMember) {
    setMembers(prev => prev.map(m => m.id === updated.id ? { ...m, role: updated.role } : m))
  }

  const canManage = orgRole === 'owner'

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {showTransfer && orgId && (
        <TransferModal
          members={members}
          orgId={orgId}
          onClose={() => setShowTransfer(false)}
          onDone={() => { setShowTransfer(false); window.location.reload() }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timu Yangu</h1>
          <p className="text-sm text-gray-500">{members.length} mwanachama{members.length !== 1 ? '' : ''}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {members.filter(m => m.role !== 'owner').length > 0 && (
              <button
                onClick={() => setShowTransfer(true)}
                className="px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition hidden sm:flex items-center gap-1"
              >
                <i className="ti ti-transfer" aria-hidden="true" />
                <span>Hamisha</span>
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
            >
              <i className="ti ti-user-plus" aria-hidden="true" />
              <span>Alika</span>
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Ongeza Mwanachama</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Simu au Barua Pepe</label>
              <input
                type="text"
                value={lookup}
                onChange={e => setLookup(e.target.value)}
                placeholder="+255 7XX XXX XXX au jina@barua.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nafasi</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as OrgRole)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleInvite}
                disabled={saving || !lookup.trim()}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40"
              >
                {saving ? 'Inaoeza...' : 'Ongeza'}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null) }}
                className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
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
            const u   = m.user as unknown as { full_name: string | null; phone: string | null; email: string | null; avatar_url: string | null }
            const isMe = m.user_id === myUserId
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt={u.full_name ?? ''} className="w-10 h-10 object-cover" />
                  ) : (
                    <span className="text-primary-600 font-bold text-sm">
                      {u?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {u?.full_name ?? '—'}
                    {isMe && <span className="ml-1.5 text-xs text-gray-400">(Wewe)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{u?.phone ?? u?.email ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canManage && m.role !== 'owner' && !isMe ? (
                    <RoleEditor member={m} orgId={orgId!} onUpdated={handleMemberUpdated} />
                  ) : (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadgeClass(m.role)}`}>
                      {ORG_ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {canManage && m.role !== 'owner' && !isMe && (
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

      {canManage && members.filter(m => m.role !== 'owner').length > 0 && (
        <div className="mt-4 sm:hidden">
          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <i className="ti ti-transfer" aria-hidden="true" />
            Hamisha Umiliki wa Shirika
          </button>
        </div>
      )}
    </div>
  )
}
