'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  CLIENT_AGREEMENT_CONTENT_SW,
  CLIENT_AGREEMENT_CONTENT_EN,
  CLIENT_CHECKBOXES,
  CLIENT_AGREEMENT_VERSION,
  DALALI_AGREEMENT_CONTENT_SW,
  DALALI_AGREEMENT_CONTENT_EN,
  DALALI_CHECKBOXES,
  DALALI_AGREEMENT_VERSION,
} from '@/lib/legal/agreements'

type Role = 'client' | 'dalali'

interface AgreementData {
  version: string
  full_name_signed: string
  phone_signed: string
  checkboxes_checked: Record<string, boolean>
}

interface AgreementModalProps {
  role: Role
  prefillName?: string
  prefillPhone?: string
  onAccept: (data: AgreementData) => void
  onBack?: () => void
  /** When true, shows as full-page (agreement-required flow), not inline */
  fullPage?: boolean
}

export default function AgreementModal({
  role,
  prefillName = '',
  prefillPhone = '',
  onAccept,
  onBack,
  fullPage = false,
}: AgreementModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasScrolled, setHasScrolled] = useState(false)
  const [lang, setLang] = useState<'sw' | 'en'>('sw')
  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({})
  const [fullName, setFullName] = useState(prefillName)
  const [phone, setPhone] = useState(prefillPhone)
  const [scrollPct, setScrollPct] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const contentSW = role === 'client' ? CLIENT_AGREEMENT_CONTENT_SW : DALALI_AGREEMENT_CONTENT_SW
  const contentEN = role === 'client' ? CLIENT_AGREEMENT_CONTENT_EN : DALALI_AGREEMENT_CONTENT_EN
  const boxes     = role === 'client' ? CLIENT_CHECKBOXES : DALALI_CHECKBOXES
  const version   = role === 'client' ? CLIENT_AGREEMENT_VERSION : DALALI_AGREEMENT_VERSION

  const content = lang === 'sw' ? contentSW : contentEN

  // Track scroll progress
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
    setScrollPct(Math.round(pct))
    if (pct >= 95) setHasScrolled(true)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Reset scroll when language changes
  useEffect(() => {
    setHasScrolled(false)
    setScrollPct(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [lang])

  const allChecked = boxes.every(b => checkboxes[b.id])
  const canAccept  = hasScrolled && allChecked && fullName.trim().length >= 3 && phone.trim().length >= 9

  function toggleCheckbox(id: string) {
    setCheckboxes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleAccept() {
    if (!canAccept) return
    setError('')
    setSubmitting(true)
    try {
      onAccept({
        version,
        full_name_signed: fullName.trim(),
        phone_signed: phone.trim(),
        checkboxes_checked: checkboxes,
      })
    } catch {
      setError('Imeshindwa kukubali. Jaribu tena.')
      setSubmitting(false)
    }
  }

  const titleSW = role === 'client'
    ? 'Masharti na Miongozo ya Matumizi'
    : 'Mkataba wa Dalali'
  const titleEN = role === 'client'
    ? 'Terms and Conditions'
    : 'Broker Agreement'

  return (
    <div className={fullPage
      ? 'min-h-screen bg-gray-50 flex flex-col'
      : 'flex flex-col h-full'
    }>
      {/* Header */}
      <div className="bg-[#1D9E75] px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {onBack && (
            <button onClick={onBack} className="text-white/80 text-xl leading-none p-1">
              ←
            </button>
          )}
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-tight">
              {lang === 'sw' ? titleSW : titleEN}
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              {role === 'client' ? '🔍 Mteja / Client' : '🏢 Dalali / Broker'} · v{version}
            </p>
          </div>
          {/* Language toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/30 flex-shrink-0">
            <button
              onClick={() => setLang('sw')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                lang === 'sw' ? 'bg-white text-[#1D9E75]' : 'text-white'
              }`}
            >
              SW
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                lang === 'en' ? 'bg-white text-[#1D9E75]' : 'text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Scroll progress bar */}
      <div className="h-1 bg-gray-200 flex-shrink-0">
        <div
          className="h-full bg-[#1D9E75] transition-all duration-200"
          style={{ width: `${scrollPct}%` }}
        />
      </div>

      {/* Commitments preview — shown upfront so user knows what they'll agree to */}
      <div className="bg-primary-50 border-b border-primary-100 px-4 py-3 flex-shrink-0">
        <p className="text-xs font-semibold text-primary-800 mb-2 max-w-lg mx-auto">
          {lang === 'sw' ? '📋 Utakubali yafuatayo:' : '📋 You will agree to the following:'}
        </p>
        <ul className="space-y-1 max-w-lg mx-auto">
          {boxes.map(b => (
            <li key={b.id} className="flex items-start gap-2 text-xs text-primary-700">
              <span className="text-primary-400 flex-shrink-0 mt-0.5">○</span>
              {lang === 'sw' ? b.sw : b.en}
            </li>
          ))}
        </ul>
      </div>

      {/* Scroll-to-read notice */}
      {!hasScrolled && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-shrink-0">
          <p className="text-amber-700 text-xs text-center font-medium max-w-lg mx-auto">
            ⚠️ {lang === 'sw'
              ? `Soma hadi mwisho ili uweze kukubali (${scrollPct}% imesomwa)`
              : `Read to the bottom to accept (${scrollPct}% read)`
            }
          </p>
        </div>
      )}

      {/* Agreement text */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full"
      >
        <div className="space-y-1">
          {content.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2" />
            if (line.startsWith('**') && line.endsWith('**')) {
              return (
                <p key={i} className="font-bold text-gray-900 text-sm mt-3">
                  {line.replace(/\*\*/g, '')}
                </p>
              )
            }
            if (line.startsWith('━')) {
              return <hr key={i} className="border-gray-200 my-3" />
            }
            return (
              <p key={i} className="text-gray-700 text-xs leading-relaxed">
                {line}
              </p>
            )
          })}
        </div>
        {hasScrolled && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <span className="text-green-600 text-xs font-medium">
              ✅ {lang === 'sw' ? 'Umesoma makubaliano yote' : 'You have read the full agreement'}
            </span>
          </div>
        )}
      </div>

      {/* Acceptance form */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-4 space-y-3 max-w-lg mx-auto w-full">

        {/* Checkboxes */}
        <div className="space-y-2.5">
          {boxes.map(box => (
            <label
              key={box.id}
              className={`flex items-start gap-3 cursor-pointer ${!hasScrolled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  checkboxes[box.id]
                    ? 'bg-[#1D9E75] border-[#1D9E75]'
                    : 'border-gray-300 bg-white'
                }`}
                onClick={() => hasScrolled && toggleCheckbox(box.id)}
              >
                {checkboxes[box.id] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-700 leading-relaxed">
                {lang === 'sw' ? box.sw : box.en}
              </span>
            </label>
          ))}
        </div>

        {/* Signature fields */}
        {hasScrolled && allChecked && (
          <div className="space-y-3 pt-1">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                ✍️ {lang === 'sw' ? 'Sahihi ya Kidijitali' : 'Digital Signature'}
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">
                    {lang === 'sw' ? 'Jina lako kamili (kama ilivyo kwenye NIDA)' : 'Your full name (as on NIDA/ID)'}
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={lang === 'sw' ? 'Andika jina lako kamili hapa...' : 'Type your full name here...'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">
                    {lang === 'sw' ? 'Nambari ya simu (WhatsApp)' : 'Phone number (WhatsApp)'}
                    <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-500 text-xs text-center">{error}</p>
        )}

        {/* Why disabled */}
        {!canAccept && (
          <div className="text-xs text-gray-400 space-y-0.5">
            {!hasScrolled && (
              <p>⬇️ {lang === 'sw' ? 'Soma hadi mwisho wa makubaliano' : 'Scroll to the bottom of the agreement'}</p>
            )}
            {hasScrolled && !allChecked && (
              <p>☑️ {lang === 'sw' ? 'Tia alama kwenye visanduku vyote' : 'Check all checkboxes above'}</p>
            )}
            {hasScrolled && allChecked && fullName.trim().length < 3 && (
              <p>✍️ {lang === 'sw' ? 'Andika jina lako kamili' : 'Enter your full name'}</p>
            )}
            {hasScrolled && allChecked && fullName.trim().length >= 3 && phone.trim().length < 9 && (
              <p>📱 {lang === 'sw' ? 'Weka nambari ya simu sahihi' : 'Enter a valid phone number'}</p>
            )}
          </div>
        )}

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={!canAccept || submitting}
          className={`w-full py-3.5 min-h-[48px] rounded-xl text-sm font-bold transition-all ${
            canAccept && !submitting
              ? 'bg-[#1D9E75] text-white hover:bg-[#158a63] active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting
            ? (lang === 'sw' ? 'Inakubali...' : 'Accepting...')
            : canAccept
              ? (lang === 'sw' ? '✅ Nakubaliana na Masharti Yote' : '✅ I Agree to All Terms')
              : (lang === 'sw' ? 'Nakubaliana / I Agree' : 'Nakubaliana / I Agree')
          }
        </button>

        <p className="text-[10px] text-gray-400 text-center">
          {lang === 'sw'
            ? 'Makubaliano haya yanabakisha kisheria. IP na wakati wa kukubaliana vitahifadhiwa.'
            : 'This agreement is legally binding. Your IP address and acceptance time will be recorded.'
          }
        </p>
      </div>
    </div>
  )
}
