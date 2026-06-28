'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AgreementModal from '@/components/legal/AgreementModal'

type Role = 'client' | 'dalali'

interface AgreementData {
  version: string
  full_name_signed: string
  phone_signed: string
  checkboxes_checked: Record<string, boolean>
}

export default function AgreementRequiredPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('users')
        .select('role, full_name, agreement_accepted')
        .eq('id', user.id)
        .single()

      if (data?.agreement_accepted) {
        // Already accepted — redirect to their dashboard
        const dest = data.role === 'dalali' ? '/dashboard' : '/'
        router.replace(dest)
        return
      }

      setRole((data?.role as Role) ?? 'client')
      setUserName(data?.full_name ?? '')
      setLoading(false)
    }
    loadUser()
  }, [supabase, router])

  async function handleAccept(agreementData: AgreementData) {
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/v1/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agreementData),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Imeshindwa kukubali')
      }

      // Redirect to appropriate dashboard
      const dest = role === 'dalali' ? '/dashboard' : '/'
      router.replace(dest)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kukubali. Jaribu tena.')
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!role) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Notice banner */}
      <div className="bg-amber-500 px-4 py-3 flex-shrink-0">
        <p className="text-white text-xs text-center font-medium max-w-lg mx-auto">
          Ili kuendelea kutumia NyumbaFasta, lazima ukubali masharti ya matumizi kwanza.
          {' / '}
          To continue using NyumbaFasta, you must accept the terms of use first.
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <AgreementModal
          role={role}
          prefillName={userName}
          onAccept={handleAccept}
          fullPage
        />
      </div>

      {error && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Inakubali masharti...</p>
          </div>
        </div>
      )}

      {/* Sign out link */}
      <div className="text-center py-3 flex-shrink-0">
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 underline"
        >
          Toka kwenye akaunti / Sign out
        </button>
      </div>
    </div>
  )
}
