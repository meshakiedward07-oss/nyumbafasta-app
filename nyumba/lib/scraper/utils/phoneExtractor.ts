export function extractTanzaniaPhone(text: string): string | null {
  const patterns = [
    /\+255[67]\d{8}/g,
    /255[67]\d{8}/g,
    /0[67]\d{8}/g,
    /\+255\s?[67]\d{2}\s?\d{3}\s?\d{3}/g
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return formatPhone(match[0])
    }
  }
  return null
}

export function extractAllPhones(text: string): string[] {
  const phones = new Set<string>()
  const pattern = /(\+?255|0)[67]\d{8}/g
  const matches = text.match(pattern) || []
  matches.forEach(p => phones.add(formatPhone(p)))
  return Array.from(phones)
}

export function extractEmail(text: string): string | null {
  const match = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  )
  return match ? match[0].toLowerCase() : null
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  if (cleaned.startsWith('+255')) return cleaned
  if (cleaned.startsWith('255')) return '+' + cleaned
  if (cleaned.startsWith('0')) return '+255' + cleaned.slice(1)
  if (cleaned.length === 9) return '+255' + cleaned
  return phone
}

export function extractWhatsApp(text: string): string | null {
  const waMatch = text.match(/wa\.me\/(\d+)/)
  if (waMatch) return '+' + waMatch[1]
  const waText = text.match(/whatsapp[:\s]+(\+?255[67]\d{8})/i)
  if (waText) return formatPhone(waText[1])
  return null
}
