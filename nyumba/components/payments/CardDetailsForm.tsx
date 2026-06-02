'use client'
import { useState } from 'react'

export type CardDetails = {
  cardNumber:   string
  cardHolder:   string
  expiryMonth:  string
  expiryYear:   string
  cvv:          string
}

type Props = {
  cardType: 'visa' | 'mastercard'
  amount:   number
  onSubmit: (details: CardDetails) => void
  onBack:   () => void
}

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

export default function CardDetailsForm({ cardType, amount, onSubmit, onBack }: Props) {
  const [card, setCard] = useState<CardDetails>({
    cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', cvv: '',
  })
  const [errors, setErrors] = useState<Partial<CardDetails>>({})
  const [showCvv, setShowCvv] = useState(false)

  const cardColor  = cardType === 'visa' ? '#1A1F71' : '#EB001B'
  const cardGrad   = cardType === 'visa'
    ? 'linear-gradient(135deg, #1A1F71 0%, #2E35A8 100%)'
    : 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)'
  const cardIcon   = `/payment_icons/${cardType}.png`

  function validate(): boolean {
    const e: Partial<CardDetails> = {}
    const digits = card.cardNumber.replace(/\s/g, '')
    if (digits.length < 16)                  e.cardNumber  = 'Tarakimu 16 zinahitajika'
    if (card.cardHolder.trim().length < 3)   e.cardHolder  = 'Jina la mmiliki linahitajika'
    if (!card.expiryMonth || !card.expiryYear) e.expiryMonth = 'Tarehe ya kumalizika inahitajika'
    if (card.cvv.length < 3)                 e.cvv         = 'CVV lazima iwe tarakimu 3–4'
    if (card.expiryMonth && card.expiryYear) {
      const exp = new Date(parseInt('20' + card.expiryYear), parseInt(card.expiryMonth) - 1)
      if (exp < new Date())                  e.expiryMonth = 'Kadi imemalizika muda wake'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (validate()) onSubmit(card)
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-4">

      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 active:opacity-70">
        ← Rudi — chagua njia nyingine
      </button>

      {/* ── Card preview ── */}
      <div
        className="relative w-full h-44 rounded-2xl p-5 text-white shadow-xl overflow-hidden select-none"
        style={{ background: cardGrad }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -right-2 w-44 h-44 rounded-full bg-white/10" />

        {/* Card type logo */}
        <div className="absolute top-4 right-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardIcon} alt={cardType} className="h-8 w-auto object-contain brightness-0 invert" />
        </div>

        {/* Chip */}
        <div className="w-10 h-7 rounded-md bg-yellow-300/70 mt-1 mb-4" />

        {/* Number */}
        <p className="font-mono text-lg tracking-widest mb-3 drop-shadow">
          {card.cardNumber || '•••• •••• •••• ••••'}
        </p>

        {/* Bottom row */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] opacity-60 uppercase tracking-wider">Mmiliki</p>
            <p className="text-sm font-semibold uppercase tracking-wide">
              {card.cardHolder || 'JINA LAKO'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] opacity-60 uppercase tracking-wider">Inaisha</p>
            <p className="text-sm font-semibold">
              {card.expiryMonth || 'MM'}/{card.expiryYear || 'YY'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Card number ── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nambari ya Kadi</label>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="1234 5678 9012 3456"
          value={card.cardNumber}
          onChange={e => setCard({ ...card, cardNumber: formatCardNumber(e.target.value) })}
          maxLength={19}
          className={`w-full px-4 py-3 border-2 rounded-xl font-mono text-lg tracking-wider
            focus:outline-none transition-colors
            ${errors.cardNumber ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
        />
        {errors.cardNumber && <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>}
      </div>

      {/* ── Card holder ── */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Jina la Mmiliki wa Kadi</label>
        <input
          type="text"
          placeholder="JOHN DOE"
          value={card.cardHolder}
          onChange={e => setCard({ ...card, cardHolder: e.target.value.toUpperCase() })}
          className={`w-full px-4 py-3 border-2 rounded-xl uppercase tracking-wider
            focus:outline-none transition-colors
            ${errors.cardHolder ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
        />
        {errors.cardHolder && <p className="text-red-500 text-xs mt-1">{errors.cardHolder}</p>}
      </div>

      {/* ── Expiry + CVV ── */}
      <div className="grid grid-cols-2 gap-3">

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Tarehe ya Kumalizika</label>
          <div className="flex gap-1.5">
            <select
              value={card.expiryMonth}
              onChange={e => setCard({ ...card, expiryMonth: e.target.value })}
              className={`flex-1 px-2 py-3 border-2 rounded-xl text-sm focus:outline-none
                ${errors.expiryMonth ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
            >
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={card.expiryYear}
              onChange={e => setCard({ ...card, expiryYear: e.target.value })}
              className={`flex-1 px-2 py-3 border-2 rounded-xl text-sm focus:outline-none
                ${errors.expiryMonth ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
            >
              <option value="">YY</option>
              {Array.from({ length: 10 }, (_, i) => String(currentYear + i).slice(2)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {errors.expiryMonth && <p className="text-red-500 text-xs mt-1">{errors.expiryMonth}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
            CVV <span className="text-gray-400 font-normal">(nyuma ya kadi)</span>
          </label>
          <div className="relative">
            <input
              type={showCvv ? 'text' : 'password'}
              inputMode="numeric"
              placeholder="123"
              value={card.cvv}
              onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              maxLength={4}
              className={`w-full px-4 py-3 border-2 rounded-xl font-mono text-center text-lg
                focus:outline-none transition-colors
                ${errors.cvv ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
            />
            <button
              type="button"
              onClick={() => setShowCvv(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
            >
              {showCvv ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
        <span className="text-base flex-shrink-0 mt-0.5">🔒</span>
        <p className="text-xs text-gray-500">
          Taarifa zako za kadi zinalindwa na SSL encryption.
          NyumbaFasta haihifadhi nambari za kadi.
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 rounded-2xl font-bold text-white text-sm shadow-lg
                   active:scale-[0.97] transition-transform"
        style={{ backgroundColor: cardColor }}
      >
        🔒 Lipa Tsh {amount.toLocaleString()} Salama
      </button>
    </div>
  )
}
