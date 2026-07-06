'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectProvider } from '@/lib/payments/azampay'
import type { PaymentMethod } from '@/components/payments/PaymentMethodSelector'
import { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import Image from 'next/image'

type Step = 'amount' | 'phone' | 'waiting' | 'success' | 'failed'

const PRESETS = [5_000, 10_000, 20_000, 50_000]
const POLL_INTERVAL_MS = 3_000
const TIMEOUT_SECS     = 240

function normalisePhone(raw: string): { normalized: string; valid: boolean } {
  const digits   = raw.replace(/\D/g, '')
  const stripped = digits.replace(/^(255|0)/, '')
  const normalized = `255${stripped}`
  return { normalized, valid: stripped.length === 9 }
}

type Props = {
  onClose:    () => void
  onSuccess?: (newBalance: number) => void
}

export default function WalletTopUpModal({ onClose, onSuccess }: Props) {
  const supabase = createClient()

  const [step, setStep]           = useState<Step>('amount')
  const [amount, setAmount]       = useState<number>(10_000)
  const [customAmt, setCustomAmt] = useState('')
  const [provider, setProvider]   = useState<PaymentMethod>('Mpesa')
  const [phone, setPhone]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const topupRefRef = useRef('')
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECS)
  const [newBalance, setNewBalance]   = useState<number | null>(null)
  const userChoseProvider = useRef(false)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (step !== 'waiting') return
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { stopPolling(); setStep('failed'); setError('Muda umeisha. Jaribu tena.'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step, stopPolling])

  const startPolling = useCallback((ref: string) => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('status, balance_after')
        .eq('external_id', ref)
        .eq('type', 'topup')
        .maybeSingle()

      if (data?.status === 'completed') {
        stopPolling()
        setNewBalance(data.balance_after as number)
        onSuccess?.(data.balance_after as number)
        setStep('success')
      } else if (data?.status === 'failed') {
        stopPolling()
        setStep('failed')
        setError('Malipo hayakufanikiwa. Jaribu tena.')
      }
    }, POLL_INTERVAL_MS)
  }, [supabase, stopPolling, onSuccess])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { normalized, valid } = normalisePhone(phone)
    if (!valid) { setError('Namba ya simu si sahihi'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/wallet/topup/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, msisdn: normalized, provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuanzisha')

      if (data.mock) {
        setNewBalance(null)
        onSuccess?.(0)
        setStep('success')
        return
      }

      topupRefRef.current = data.topup_ref
      setSecondsLeft(TIMEOUT_SECS)
      setStep('waiting')
      startPolling(data.topup_ref)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }

  function handlePhoneChange(v: string) {
    const digits = v.replace(/\D/g, '')
    setPhone(digits)
    if (!userChoseProvider.current && digits.length >= 9) {
      const { normalized } = normalisePhone(digits)
      setProvider(detectProvider(normalized))
    }
  }

  const pInfo = PAYMENT_METHODS.find(m => m.id === provider)!
  const progressPct = ((TIMEOUT_SECS - secondsLeft) / TIMEOUT_SECS) * 100
  const displayPhone = phone.replace(/^(255|0)/, '').replace(/^/, '0')
  const finalAmount  = customAmt ? parseInt(customAmt.replace(/\D/g, ''), 10) || 0 : amount

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={step === 'waiting' ? undefined : onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── AMOUNT ── */}
        {step === 'amount' && (
          <div className="px-5 pt-1 pb-2">
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Weka Pesa Kwenye Wallet</h2>
            <p className="text-xs text-gray-400 text-center mb-5">Chagua kiasi cha kuongeza</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESETS.map(p => (
                <button key={p}
                  onClick={() => { setAmount(p); setCustomAmt('') }}
                  className={`py-3 rounded-2xl text-sm font-semibold border-2 transition-all ${amount === p && !customAmt ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700'}`}
                >
                  Tsh {p.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mb-5">
              <label className="text-xs text-gray-500 mb-1.5 block">Au weka kiasi kingine</label>
              <div className="flex gap-2">
                <span className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">Tsh</span>
                <input
                  type="number" min="1000" max="500000" step="1000"
                  placeholder="Mfano: 15000"
                  value={customAmt}
                  onChange={e => { setCustomAmt(e.target.value); setAmount(0) }}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl mb-4">{error}</div>}
            <button
              onClick={() => {
                const val = finalAmount
                if (val < 1000) { setError('Kiwango cha chini ni Tsh 1,000'); return }
                if (val > 500_000) { setError('Kiwango cha juu ni Tsh 500,000'); return }
                if (val % 1000 !== 0) { setError('Kiasi lazima kiwe kizidisho cha 1,000'); return }
                setAmount(val)
                setError('')
                setStep('phone')
              }}
              className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold mb-2 active:scale-[0.97] transition-transform shadow-md"
            >
              Endelea → Lipa Tsh {finalAmount.toLocaleString()}
            </button>
            <button onClick={onClose} className="w-full py-3 min-h-[44px] text-sm text-gray-400 text-center">Ghairi</button>
          </div>
        )}

        {/* ── PHONE ── */}
        {step === 'phone' && (
          <div className="px-5 pt-2">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => { setStep('amount'); setError('') }} aria-label="Rudi nyuma" className="text-gray-400 text-lg p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <div>
                <p className="text-sm font-bold text-gray-900">Weka Tsh {amount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Chagua mtandao na simu ya malipo</p>
              </div>
            </div>
            {/* Provider grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PAYMENT_METHODS.map(m => (
                <button key={m.id}
                  onClick={() => { userChoseProvider.current = true; setProvider(m.id) }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${provider === m.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                >
                  {m.iconSrc ? (
                    <Image src={m.iconSrc} alt={m.iconAlt} width={48} height={24} className="h-6 w-auto object-contain" />
                  ) : (
                    <span className="inline-flex items-center justify-center rounded px-1.5 h-6 text-xs font-extrabold text-white" style={{ backgroundColor: m.color }}>{m.iconChar ?? m.name[0]}</span>
                  )}
                  <span className="text-[10px] font-semibold text-gray-600">{m.name}</span>
                </button>
              ))}
            </div>
            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl mb-4">{error}</div>}
            <form onSubmit={handleInitiate} className="space-y-4">
              <div>
                <label htmlFor="topup-phone" className="text-xs text-gray-500 mb-1.5 block">Namba ya {pInfo.name}</label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">+255</div>
                  <input
                    id="topup-phone"
                    type="tel" inputMode="numeric" required
                    placeholder={pInfo.hint.split(' ')[0] + ' XXX XXXX'}
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    maxLength={12}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || normalisePhone(phone).normalized.length !== 12}
                className="w-full text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ backgroundColor: loading || normalisePhone(phone).normalized.length !== 12 ? '#9CA3AF' : pInfo.color }}
              >
                {loading ? 'Inaanzisha...' : `Weka Tsh ${amount.toLocaleString()} na ${pInfo.name}`}
              </button>
            </form>
          </div>
        )}

        {/* ── WAITING ── */}
        {step === 'waiting' && (
          <div className="px-5 pt-2 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700 font-medium">
              Usifunge — malipo yanashughulikiwa
            </div>
            <div className="text-4xl mb-3 flex justify-center"><i className="ti ti-device-mobile text-primary-500" /></div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Angalia Simu Yako!</h2>
            <p className="text-sm text-gray-500 mb-1">Ombi la malipo limetumwa kwa <span className="font-semibold text-gray-700">+255{displayPhone.replace(/^0/, '')}</span></p>
            <p className="text-sm text-gray-500 mb-4">Ingiza PIN yako ya <span className="font-semibold">{pInfo.name}</span></p>
            <div className="bg-gray-100 rounded-full h-2 mb-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressPct}%`, backgroundColor: pInfo.color }} />
            </div>
            <p className="text-xs text-gray-400 mb-5">Inasubiri uthibitisho... ({secondsLeft}s)</p>
            <div className="flex justify-center mb-5">
              <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${pInfo.color} transparent ${pInfo.color} ${pInfo.color}` }} />
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-circle-check text-primary-500" /></div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Wallet Imewekwa!</h2>
            <p className="text-sm text-gray-500 mb-4">
              Tsh {amount.toLocaleString()} imeongezwa kwenye wallet yako.
              {newBalance !== null && <><br /><span className="font-semibold text-gray-800">Salio jipya: Tsh {newBalance.toLocaleString()}</span></>}
            </p>
            <button onClick={onClose} className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold mb-2 active:scale-[0.97] transition-transform shadow-md">Sawa</button>
          </div>
        )}

        {/* ── FAILED ── */}
        {step === 'failed' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-circle-x text-red-500" /></div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Malipo Hayakufanikiwa</h2>
            <p className="text-sm text-red-500 mb-5">{error}</p>
            <button onClick={() => { setStep('phone'); setError(''); setSecondsLeft(TIMEOUT_SECS) }} className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3 min-h-[48px]">Jaribu Tena</button>
            <button onClick={onClose} className="w-full py-3 min-h-[44px] text-sm text-gray-400">Funga</button>
          </div>
        )}
      </div>
    </div>
  )
}
