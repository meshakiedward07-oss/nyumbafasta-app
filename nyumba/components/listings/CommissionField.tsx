'use client'
import { formatCommission, type CommissionType } from '@/lib/listings/commission'

export interface CommissionState {
  enabled: boolean
  type: CommissionType | null
  value: string
  notes: string
}

interface Props {
  value: CommissionState
  onChange: (v: CommissionState) => void
}

const COMMISSION_TYPES = [
  { key: 'one_month'  as CommissionType, label: 'Miezi 1 ya Kodi', icon: 'calendar-month' },
  { key: 'percentage' as CommissionType, label: 'Asilimia (%)',    icon: 'percentage'     },
  { key: 'fixed'      as CommissionType, label: 'Kiasi Maalum',    icon: 'cash'           },
  { key: 'negotiable' as CommissionType, label: 'Inajadiliwa',     icon: 'message-2'      },
]

export default function CommissionField({ value, onChange }: Props) {
  const set = (patch: Partial<CommissionState>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kamisheni (Hiari)</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Mteja ataona baada ya kulipa unlock</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={() => set({ enabled: !value.enabled, type: null, value: '', notes: '' })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value.enabled ? 'bg-primary-500' : 'bg-gray-200'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            value.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {value.enabled && (
        <div className="space-y-3 pt-1">
          {/* Type grid */}
          <div className="grid grid-cols-2 gap-2">
            {COMMISSION_TYPES.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => set({ type: opt.key, value: '' })}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${
                  value.type === opt.key
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <i
                  className={`ti ti-${opt.icon} text-base ${value.type === opt.key ? 'text-primary-600' : 'text-gray-400'}`}
                  aria-hidden="true"
                />
                <span className={`text-xs font-medium leading-tight ${value.type === opt.key ? 'text-primary-700' : 'text-gray-600'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {/* Percentage value */}
          {value.type === 'percentage' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Asilimia (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  value={value.value}
                  onChange={e => set({ value: e.target.value })}
                  placeholder="Mf. 10"
                  className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
              </div>
            </div>
          )}

          {/* Fixed amount value */}
          {value.type === 'fixed' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Kiasi (Tsh)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Tsh</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={value.value}
                  onChange={e => set({ value: e.target.value })}
                  placeholder="Mf. 500000"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>
          )}

          {/* Notes — shown whenever a type is selected */}
          {value.type && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Maelezo ya Ziada (Hiari)
              </label>
              <input
                type="text"
                value={value.notes}
                onChange={e => set({ notes: e.target.value })}
                placeholder="Mf. Kamisheni ni ya mwezi wa kwanza tu"
                maxLength={200}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {/* Live preview */}
          {value.type && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 flex items-center gap-2">
              <i className="ti ti-coins text-primary-500 text-sm" aria-hidden="true" />
              <span className="text-xs text-primary-700 font-medium">
                Itaonyeshwa kama:{' '}
                <strong>{formatCommission(value.type, parseFloat(value.value) || null)}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
