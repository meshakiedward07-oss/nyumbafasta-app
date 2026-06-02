'use client'

// PaymentMethodSelector — shows provider grid only.
// Card form is handled by the PARENT as a separate step.
// For mobile: shows "Lipa" button → calls onPay(method)
// For card:   shows "Endelea" button → calls onPay(method) → parent shows CardDetailsForm

export type PaymentMethod = 'mpesa' | 'mixyyas' | 'airtel' | 'halopesa' | 'mastercard' | 'visa'
export type { CardDetails } from '@/components/payments/CardDetailsForm'

export const PAYMENT_METHODS = [
  {
    id:      'mpesa'      as PaymentMethod,
    name:    'M-Pesa',
    company: 'Vodacom',
    color:   '#E40000',
    bgColor: '#FFF5F5',
    type:    'mobile' as const,
    hint:    '074/075/076 XXX XXXX',
    icon:    <img src="/payment_icons/mpesa.png"      alt="M-Pesa"       className="h-9 w-auto object-contain" />,
  },
  {
    id:      'mixyyas'    as PaymentMethod,
    name:    'Mixx by YAS',
    company: 'CRDB/YAS',
    color:   '#003087',
    bgColor: '#F0F4FF',
    type:    'mobile' as const,
    hint:    '065/071 XXX XXXX',
    icon:    <img src="/payment_icons/mixx.png"       alt="Mixx by YAS"  className="h-9 w-auto object-contain" />,
  },
  {
    id:      'airtel'     as PaymentMethod,
    name:    'Airtel Money',
    company: 'Airtel',
    color:   '#FF0000',
    bgColor: '#FFF5F5',
    type:    'mobile' as const,
    hint:    '078 XXX XXXX',
    icon:    <img src="/payment_icons/airtel.png"     alt="Airtel Money" className="h-9 w-auto object-contain" />,
  },
  {
    id:      'halopesa'   as PaymentMethod,
    name:    'HaloPesa',
    company: 'TTCL',
    color:   '#F15A22',
    bgColor: '#FFF5F0',
    type:    'mobile' as const,
    hint:    '062 XXX XXXX',
    icon:    <img src="/payment_icons/halopesa.png"   alt="HaloPesa"     className="h-9 w-auto object-contain" />,
  },
  {
    id:      'visa'       as PaymentMethod,
    name:    'Visa',
    company: 'Visa Card',
    color:   '#1A1F71',
    bgColor: '#F0F4FF',
    type:    'card' as const,
    hint:    '',
    icon:    <img src="/payment_icons/visa.png"       alt="Visa"         className="h-7 w-auto object-contain" />,
  },
  {
    id:      'mastercard' as PaymentMethod,
    name:    'Mastercard',
    company: 'Mastercard',
    color:   '#EB001B',
    bgColor: '#FFF5F5',
    type:    'card' as const,
    hint:    '',
    icon:    <img src="/payment_icons/mastercard.png" alt="Mastercard"   className="h-9 w-auto object-contain" />,
  },
]

const MOBILE = PAYMENT_METHODS.filter(m => m.type === 'mobile')
const CARDS  = PAYMENT_METHODS.filter(m => m.type === 'card')

type Props = {
  selected: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
  amount:   number
  // Called when user confirms selection.
  // Parent decides next step: card → show CardDetailsForm, mobile → show phone input
  onPay:    (method: PaymentMethod) => void
}

export default function PaymentMethodSelector({ selected, onSelect, amount, onPay }: Props) {
  const selectedInfo = PAYMENT_METHODS.find(m => m.id === selected)

  function ProviderButton({ m }: { m: typeof PAYMENT_METHODS[number] }) {
    const isSelected = selected === m.id
    return (
      <button
        onClick={() => onSelect(m.id)}
        className="relative flex flex-col items-center justify-center gap-1.5 p-3
                   rounded-2xl border-2 transition-all duration-150 min-h-[80px] active:scale-[0.97]"
        style={{
          borderColor:     isSelected ? m.color   : '#E5E7EB',
          backgroundColor: isSelected ? m.bgColor : '#FFFFFF',
        }}
      >
        {isSelected && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full
                           flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: m.color }}>✓</span>
        )}
        <div className="h-10 flex items-center justify-center">{m.icon}</div>
        <p className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{m.name}</p>
        <p className="text-[9px] text-gray-400">{m.company}</p>
      </button>
    )
  }

  return (
    <div className="space-y-4">

      {/* Mobile Money */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          📱 Mobile Money
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MOBILE.map(m => <ProviderButton key={m.id} m={m} />)}
        </div>
      </div>

      {/* Kadi ya Benki */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          💳 Kadi ya Benki
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CARDS.map(m => <ProviderButton key={m.id} m={m} />)}
        </div>
      </div>

      {/* Action button — shown when any method is selected */}
      {selected && selectedInfo && (
        <div className="pt-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-7 flex items-center">{selectedInfo.icon}</div>
            <span className="text-xs text-gray-500">
              {selectedInfo.type === 'card'
                ? <>Utajaza taarifa za <strong>{selectedInfo.name}</strong></>
                : <>Utalipa kupitia <strong>{selectedInfo.name}</strong></>}
            </span>
          </div>
          <button
            onClick={() => onPay(selected)}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm
                       shadow-md active:scale-[0.97] transition-transform"
            style={{ backgroundColor: selectedInfo.color }}
          >
            {selectedInfo.type === 'card'
              ? `💳 Jaza Taarifa za Kadi →`
              : `Lipa Tsh ${amount.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  )
}
