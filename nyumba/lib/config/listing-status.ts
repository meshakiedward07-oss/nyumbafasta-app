// Shared status labels and badge constants — single source of truth across all UI
// U017: status labels; U032: boosted label

export const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Inapatikana',  cls: 'bg-primary-50 text-primary-700' },
  pending:  { label: 'Inasubiri',    cls: 'bg-amber-50 text-amber-700'     },
  taken:    { label: 'Imepangishwa', cls: 'bg-gray-100 text-gray-500'      },
  expired:  { label: 'Imeisha',      cls: 'bg-red-50 text-red-500'         },
  rejected: { label: 'Ilikataliwa',  cls: 'bg-red-50 text-red-600'         },
}

export const BOOSTED_LABEL = 'Inashauriwa'
