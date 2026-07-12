export function cleanPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!s) return null
  if (s.startsWith('255') && s.length === 12) return `+${s}`
  if (s.startsWith('0') && s.length === 10)   return `+255${s.slice(1)}`
  if (s.length === 9 && /^\d+$/.test(s))       return `+255${s}`
  if (s.length > 7) return `+${s}`
  return null
}
