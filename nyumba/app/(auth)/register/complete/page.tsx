'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterCompletePage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function finish() {
      try {
        const raw = localStorage.getItem('pending_register')
        if (!raw) {
          router.replace('/')
          return
        }

        const { full_name, role, whatsapp_number } = JSON.parse(raw)
        const agreementRaw = localStorage.getItem('pending_agreement')
        const agreement = agreementRaw ? JSON.parse(agreementRaw) : null

        localStorage.removeItem('pending_register')
        localStorage.removeItem('pending_agreement')

        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, role, whatsapp_number, agreement }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Imeshindwa kuunda akaunti')
        }

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
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-gray-700 font-medium mb-2">Hitilafu imetokea</p>
        <p className="text-sm text-red-500 text-center mb-6">{error}</p>
        <button
          onClick={() => router.replace('/')}
          className="bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
        >
          Rudi Nyumbani
        </button>
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
