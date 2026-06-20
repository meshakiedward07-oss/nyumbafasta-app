'use client'
import { useState, useEffect } from 'react'
import { STAFF_PERMISSIONS, STAFF_ROLE_TEMPLATES } from '@/lib/staff/permissions'
import type { PermissionKey } from '@/lib/staff/permissions'

type Props = {
  staff: { id: string; full_name: string }
  onClose: () => void
  onSaved: () => void
}

export default function PermissionManagerModal({ staff, onClose, onSaved }: Props) {
  const [granted,  setGranted]  = useState<Set<PermissionKey>>(new Set())
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  useEffect(() => {
    fetch(`/api/v1/admin/staff/${staff.id}/permissions`)
      .then(r => r.json())
      .then(data => setGranted(new Set(data.granted ?? [])))
      .catch(() => setError('Imeshindwa kupakia ruhusa'))
      .finally(() => setLoading(false))
  }, [staff.id])

  function toggle(key: PermissionKey) {
    setGranted(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function applyTemplate(templateKey: string) {
    setSaving(true)
    setError('')
    const res  = await fetch(`/api/v1/admin/staff/${staff.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: templateKey }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Imeshindwa'); return }
    setGranted(new Set(data.appliedPermissions ?? []))
    setSuccess(`Template "${STAFF_ROLE_TEMPLATES[templateKey as keyof typeof STAFF_ROLE_TEMPLATES]?.label}" imetumika`)
    setTimeout(() => setSuccess(''), 2000)
  }

  async function saveCustom() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/v1/admin/staff/${staff.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: Array.from(granted) }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Imeshindwa kuhifadhi'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900">🔑 Ruhusa za {staff.full_name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Chagua vipengele anavyoweza kufikia</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-3 py-2 rounded-xl">
              ✅ {success}
            </div>
          )}

          {/* Quick templates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Templates za Haraka
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STAFF_ROLE_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-[#1D9E75] hover:text-white rounded-full font-medium transition-colors disabled:opacity-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Individual checkboxes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Au Chagua Mwenyewe
            </p>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl mb-2" />
              ))
            ) : (
              <div className="space-y-2">
                {Object.values(STAFF_PERMISSIONS).map(perm => {
                  const isGranted = granted.has(perm.key as PermissionKey)
                  return (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        isGranted ? 'border-[#1D9E75] bg-[#E1F5EE]' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isGranted}
                        onChange={() => toggle(perm.key as PermissionKey)}
                        className="mt-0.5 accent-[#1D9E75]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {perm.emoji} {perm.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{perm.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Current count */}
          <p className="text-xs text-gray-400 text-center">
            Ruhusa {granted.size} kati ya {Object.keys(STAFF_PERMISSIONS).length} zimechaguliwa
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600"
          >
            Ghairi
          </button>
          <button
            onClick={saveCustom}
            disabled={saving || loading}
            className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Inahifadhi...' : 'Hifadhi Ruhusa'}
          </button>
        </div>
      </div>
    </div>
  )
}
