'use client'
import { useState, useEffect } from 'react'

type WaSetup = { webhook_url?: string; verify_token?: string; instructions?: string[] } | null
type DiagResult = { error?: string; [key: string]: unknown } | null

export default function PlatformSettingsPage() {
  const [tab, setTab]           = useState<'whatsapp' | 'diag'>('whatsapp')
  const [waSetup, setWaSetup]   = useState<WaSetup>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [diagInput, setDiagInput] = useState('')
  const [diagResult, setDiagResult] = useState<DiagResult>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  useEffect(() => {
    if (tab === 'whatsapp' && !waSetup) {
      setWaLoading(true)
      fetch('/api/v1/admin/setup-whatsapp')
        .then(r => r.json())
        .then((d: WaSetup) => setWaSetup(d))
        .catch(() => setWaSetup(null))
        .finally(() => setWaLoading(false))
    }
  }, [tab, waSetup])

  async function runDiag() {
    if (!diagInput.trim()) return
    setDiagLoading(true)
    setDiagResult(null)
    try {
      const res  = await fetch('/api/v1/admin/diag-advertiser', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ advertiser_id: diagInput.trim() }),
      })
      const data = await res.json() as DiagResult
      setDiagResult(data)
    } catch {
      setDiagResult({ error: 'Imeshindwa kuunganika' })
    } finally {
      setDiagLoading(false)
    }
  }

  const TABS = [
    { key: 'whatsapp' as const, label: 'WhatsApp Setup', icon: 'brand-whatsapp' },
    { key: 'diag'     as const, label: 'Diagnostics',    icon: 'bug'            },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mipangilio ya Mfumo</h1>
        <p className="text-sm text-gray-500 mt-0.5">Simamia mipangilio ya jukwaa — bei, WhatsApp, na zana za uchunguzi</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`ti ti-${t.icon} text-base`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* WhatsApp Setup tab */}
      {tab === 'whatsapp' && (
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
                    <button onClick={() => navigator.clipboard.writeText(waSetup.webhook_url!)}
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
      )}

      {/* Diagnostics tab */}
      {tab === 'diag' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <i className="ti ti-bug text-orange-500" /> Zana za Uchunguzi
          </h2>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chunguza Mwanabiashara (Advertiser ID)</p>
            <div className="flex gap-2">
              <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
                placeholder="Weka ID ya mwanabiashara..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300" />
              <button onClick={runDiag} disabled={diagLoading || !diagInput.trim()}
                className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors">
                {diagLoading ? 'Inachunguza...' : 'Chunguza'}
              </button>
            </div>
          </div>
          {diagResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Matokeo</p>
              {diagResult.error ? (
                <p className="text-sm text-red-600">{diagResult.error}</p>
              ) : (
                <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(diagResult, null, 2)}
                </pre>
              )}
            </div>
          )}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              <i className="ti ti-info-circle" /> Zana hii inatumiwa na watengenezaji wa mfumo kuchunguza matatizo ya matangazo.
              Pia tazama: <a href="/admin/adverts" className="text-primary-600 hover:underline">Kampeni za Matangazo</a>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
