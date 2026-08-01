'use client'
import { useState, useEffect } from 'react'

type WaSetup = { webhook_url?: string; verify_token?: string; instructions?: string[] } | null

export default function PlatformSettingsPage() {
  const [waSetup,   setWaSetup]   = useState<WaSetup>(null)
  const [waLoading, setWaLoading] = useState(false)

  useEffect(() => {
    setWaLoading(true)
    fetch('/api/v1/admin/setup-whatsapp')
      .then(r => r.json())
      .then((d: WaSetup) => setWaSetup(d))
      .catch(() => setWaSetup(null))
      .finally(() => setWaLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mipangilio ya Mfumo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Simamia mipangilio ya jukwaa — WhatsApp webhook na usanidi</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <i className="ti ti-brand-whatsapp text-green-600" /> WhatsApp Webhook Setup
        </h2>
        {waLoading ? (
          <div className="text-sm text-gray-400">Inapakia...</div>
        ) : waSetup ? (
          <div className="space-y-4">
            {waSetup.webhook_url && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 font-mono break-all">
                    {waSetup.webhook_url}
                  </code>
                  <button onClick={() => navigator.clipboard.writeText(waSetup!.webhook_url!)}
                    className="flex-shrink-0 text-xs px-3 py-2.5 bg-primary-500 text-white rounded-xl font-medium">
                    Nakili
                  </button>
                </div>
              </div>
            )}
            {waSetup.verify_token && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verify Token</p>
                <code className="block text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 font-mono">
                  {waSetup.verify_token}
                </code>
              </div>
            )}
            {waSetup.instructions && waSetup.instructions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hatua za Usanidi</p>
                <ol className="space-y-2">
                  {waSetup.instructions.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-semibold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!waSetup.webhook_url && !waSetup.verify_token && (
              <pre className="text-xs bg-gray-50 p-3 rounded-xl overflow-auto text-gray-700">
                {JSON.stringify(waSetup, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Imeshindwa kupata maelekezo ya usanidi.</p>
        )}
      </div>
    </div>
  )
}
