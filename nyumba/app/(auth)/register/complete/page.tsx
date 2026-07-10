'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function clearPendingStorage() {
  try { localStorage.removeItem('pending_register') } catch {}
  try { localStorage.removeItem('pending_agreement') } catch {}
}

export default function RegisterCompletePage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function finish() {
      let raw: string | null = null
      let pending: { full_name: string; role: string; whatsapp_number?: string } | null = null

      // Guard: missing pending_register → user opened this URL directly or storage
      // was cleared. Send them back to the start rather than creating a broken row.
      try {
        raw = localStorage.getItem('pending_register')
        if (!raw) { router.replace('/register'); return }
        pending = JSON.parse(raw)
      } catch {
        // Corrupted storage — clear it and restart cleanly
        clearPendingStorage()
        router.replace('/register')
        return
      }

      const { full_name, role, whatsapp_number } = pending!

      // Safe parse of agreement — corrupted JSON must not lock the user out
      let agreement: unknown = null
      try {
        const agreementRaw = localStorage.getItem('pending_agreement')
        if (agreementRaw) agreement = JSON.parse(agreementRaw)
      } catch {
        // Clear the bad key but continue — the API accepts agreement:null
        try { localStorage.removeItem('pending_agreement') } catch {}
      }

      try {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, role, whatsapp_number, agreement }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Imeshindwa kuunda akaunti')
        }

        clearPendingStorage()

        if (role === 'dalali') {
          router.replace('/dashboard?welcome=true')
        } else {
          router.replace('/?welcome=true')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      }
    }

    finish()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4 flex justify-center">
          <i className="ti ti-alert-triangle text-amber-500" aria-hidden="true" />
        </div>
        <p className="text-gray-700 font-medium mb-2">Hitilafu imetokea</p>
        <p className="text-sm text-red-500 text-center mb-6">{error}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { setError(''); window.location.reload() }}
            className="bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Jaribu Tena
          </button>
          <button
            onClick={() => {
              // Clear storage so a fresh reload of /register doesn't re-read stale data
              clearPendingStorage()
              router.replace('/register')
            }}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Rudi Usajili
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500">Inamaliza usajili wako...</p>
    </div>
  )
}
