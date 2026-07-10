import type { CommissionType } from '@/lib/types/database'

export type { CommissionType }

const TYPE_LABELS: Record<CommissionType, string> = {
  one_month:  'Miezi 1 ya kodi',
  percentage: 'Asilimia',
  fixed:      'Kiasi maalum',
  negotiable: 'Inajadiliwa',
}

function fmtAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return String(n)
}

export function formatCommission(type: CommissionType | null, value: number | null): string {
  if (!type) return ''
  switch (type) {
    case 'one_month':  return 'Miezi 1 ya kodi'
    case 'percentage': return value ? `${value}%` : TYPE_LABELS.percentage
    case 'fixed':      return value ? `Tsh ${fmtAmount(value)}` : TYPE_LABELS.fixed
    case 'negotiable': return 'Inajadiliwa'
  }
}

export function calculateCommissionAmount(
  type: CommissionType,
  value: number | null,
  priceMonthly: number,
): number | null {
  switch (type) {
    case 'one_month':  return priceMonthly
    case 'percentage': return value ? Math.round(priceMonthly * value / 100) : null
    case 'fixed':      return value
    case 'negotiable': return null
  }
}

export function validateCommission(type: CommissionType | null, value: number | null): string | null {
  if (!type) return null
  if (type === 'percentage' && value !== null && (value <= 0 || value > 100)) {
    return 'Asilimia lazima iwe kati ya 1 na 100'
  }
  if (type === 'fixed' && value !== null && value <= 0) {
    return 'Kiasi lazima kiwe zaidi ya 0'
  }
  return null
}
