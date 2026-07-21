'use client'
import { useState } from 'react'

export default function ResendEmailButton({ email }: { email: string }) {
  const [loading, setLoading]     = useState(false)
  const [sent, setSent]           = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError]         = useState('')

  async function handleResend() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || 'Imeshindwa kutuma. Jaribu tena.')
      }

      setSent(true)
      setCountdown(60)

      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); setSent(false); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutuma. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
        <p className="text-green-700 text-sm font-medium">
          <i className="ti ti-circle-check" aria-hidden="true" /> Email imetumwa tena!
        </p>
        <p className="text-green-600 text-xs mt-1">
          Unaweza kutuma tena baada ya sekunde {countdown}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      <button
        onClick={handleResend}
        disabled={loading}
        className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-medium
                   hover:border-primary-500 hover:text-primary-500 transition-colors disabled:opacity-50"
      >
        {loading
          ? 'Inatuma...'
          : <><i className="ti ti-mail" aria-hidden="true" /> Tuma Email Tena</>
        }
      </button>
    </div>
  )
}
