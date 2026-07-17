// Tanzania phone number normalisation
// Accepts: 0712345678, 255712345678, +255712345678, 712 345 678
// Returns: 255712345678 (digits only, international format, no +)

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `255${digits.slice(1)}`
  if (digits.length === 9) return `255${digits}`
  return digits
}

// Build a wa.me link from any format TZ phone number.
// Returns '#' if the number is empty or can't be resolved.
export function waLink(phone: string | null | undefined, message?: string): string {
  if (!phone) return '#'
  const n = normalizePhone(phone)
  if (!n || n.length < 9) return '#'
  const base = `https://wa.me/${n}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
