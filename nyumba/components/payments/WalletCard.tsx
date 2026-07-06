'use client'
import { useState, useEffect } from 'react'
import WalletTopUpModal from './WalletTopUpModal'

interface WalletTx {
  id:             string
  type:           'topup' | 'payment' | 'refund'
  amount:         number
  description?:   string
  status:         string
  created_at:     string
  provider?:      string
  reference_type?: string
}

interface WalletData {
  balance:      number
  is_frozen:    boolean
  transactions: WalletTx[]
}

function TxIcon({ type, referenceType }: { type: string; referenceType?: string }) {
  if (type === 'topup')   return <i className="ti ti-arrow-down-circle text-green-500" />
  if (type === 'refund')  return <i className="ti ti-refresh text-blue-500" />
  if (referenceType === 'unlock')       return <i className="ti ti-lock-open text-amber-500" />
  if (referenceType === 'subscription') return <i className="ti ti-star text-purple-500" />
  if (referenceType === 'boost')        return <i className="ti ti-bolt text-orange-500" />
  return <i className="ti ti-arrow-up-circle text-red-400" />
}

function TxLabel({ type, referenceType, description }: { type: string; referenceType?: string; description?: string }) {
  if (description) return <>{description}</>
  if (type === 'topup')   return <>Weka pesa</>
  if (type === 'refund')  return <>Refund</>
  if (referenceType === 'unlock')       return <>Fungua contact</>
  if (referenceType === 'subscription') return <>Subscription</>
  if (referenceType === 'boost')        return <>Boost listing</>
  return <>Malipo</>
}

export default function WalletCard() {
  const [data, setData]       = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTopUp, setShowTopUp] = useState(false)
  const [showTxs, setShowTxs]    = useState(false)

  async function fetchWallet() {
    try {
      const res = await fetch('/api/v1/wallet')
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchWallet() }, [])

  function handleTopUpSuccess(newBalance: number) {
    if (data) setData({ ...data, balance: newBalance > 0 ? newBalance : data.balance })
    // Refresh full data after short delay
    setTimeout(() => fetchWallet(), 1_500)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
        <div className="h-8 bg-gray-100 rounded w-40 mb-3" />
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
      </div>
    )
  }

  const balance = data?.balance ?? 0

  return (
    <>
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <i className="ti ti-wallet text-lg" />
            <span className="text-sm font-semibold opacity-90">NyumbaFasta Wallet</span>
          </div>
          {data?.is_frozen && (
            <span className="text-xs bg-red-400/30 text-red-100 px-2 py-0.5 rounded-full">Imezuiwa</span>
          )}
        </div>

        <p className="text-3xl font-bold mb-0.5">
          Tsh {balance.toLocaleString()}
        </p>
        <p className="text-xs opacity-70 mb-4">Salio lako la sasa</p>

        <div className="flex gap-3">
          <button
            onClick={() => setShowTopUp(true)}
            className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] min-h-[44px]"
          >
            <i className="ti ti-plus mr-1.5" />Weka Pesa
          </button>
          <button
            onClick={() => setShowTxs(v => !v)}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-all active:scale-[0.97] min-h-[44px]"
          >
            <i className="ti ti-history mr-1.5" />Historia
          </button>
        </div>
      </div>

      {/* Transaction list */}
      {showTxs && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Historia ya Malipo</p>
          </div>
          {!data?.transactions?.length ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Hakuna historia ya malipo bado.
            </div>
          ) : (
            <ul>
              {data.transactions.map(tx => (
                <li key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">
                    <TxIcon type={tx.type} referenceType={tx.reference_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      <TxLabel type={tx.type} referenceType={tx.reference_type} description={tx.description} />
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {tx.provider && <span className="ml-1">· {tx.provider}</span>}
                      {tx.status === 'pending' && <span className="ml-1 text-amber-500">· Inasubiri</span>}
                      {tx.status === 'failed'  && <span className="ml-1 text-red-400">· Ilishindwa</span>}
                    </p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${tx.type === 'topup' || tx.type === 'refund' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'topup' || tx.type === 'refund' ? '+' : '−'}
                    Tsh {tx.amount.toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showTopUp && (
        <WalletTopUpModal
          onClose={() => setShowTopUp(false)}
          onSuccess={handleTopUpSuccess}
        />
      )}
    </>
  )
}
