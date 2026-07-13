export function cleanPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  let s = String(raw).replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!s) return null

  // Strip trailing 0 that makes Tanzania numbers one digit too long (common Excel/CSV artifact)
  // +255XXXXXXXXX0 → +255XXXXXXXXX  (255 + 9 local + rogue 0 = 13 chars)
  if (s.startsWith('255') && s.length === 13 && s.endsWith('0')) s = s.slice(0, 12)
  // 0XXXXXXXXX0 → 0XXXXXXXXX  (0 + 9 local + rogue 0 = 11 chars)
  if (s.startsWith('0') && s.length === 11 && s.endsWith('0')) s = s.slice(0, 10)
  // XXXXXXXXX0 → XXXXXXXXX  (9 local + rogue 0 = 10 chars)
  if (s.length === 10 && /^\d+$/.test(s) && !s.startsWith('0') && !s.startsWith('255') && s.endsWith('0')) s = s.slice(0, 9)

  // 2550XXXXXXXXX → 255XXXXXXXXX  (country code + redundant leading 0, 13 digits total)
  if (s.startsWith('2550') && s.length === 13 && /^\d+$/.test(s)) s = '255' + s.slice(4)

  if (s.startsWith('255') && s.length === 12) return `+${s}`
  if (s.startsWith('0') && s.length === 10)   return `+255${s.slice(1)}`
  if (s.length === 9 && /^\d+$/.test(s))       return `+255${s}`
  if (s.length > 7) return `+${s}`
  return null
}
