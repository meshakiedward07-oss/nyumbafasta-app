const GRAPH_URL = 'https://graph.facebook.com/v18.0'

function phoneId(): string {
  const id = process.env.WHATSAPP_PHONE_ID
  if (!id) throw new Error('WHATSAPP_PHONE_ID haijawekwa')
  return id
}

function token(): string {
  const t = process.env.WHATSAPP_TOKEN
  if (!t) throw new Error('WHATSAPP_TOKEN haijawekwa')
  return t
}

function headers() {
  return {
    'Authorization': `Bearer ${token()}`,
    'Content-Type': 'application/json',
  }
}

// ── Phone number normalisation ─────────────────────────────────────────────

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `255${digits.slice(1)}`
  if (digits.length === 9) return `255${digits}`
  return digits
}

// ── Core send functions ────────────────────────────────────────────────────

export async function sendTextMessage(to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH_URL}/${phoneId()}/messages`, {
      method:  'POST',
      headers: headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body, preview_url: false },
      }),
    })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) {
      console.error('[WA] sendTextMessage failed:', JSON.stringify(json).slice(0, 200))
      return false
    }
    console.log('[WA] Message sent to', to.slice(0, 6) + '****')
    return true
  } catch (err) {
    console.error('[WA] sendTextMessage error:', err)
    return false
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  params: string[],
  languageCode = 'sw',
): Promise<boolean> {
  try {
    const components = params.length > 0 ? [{
      type: 'body',
      parameters: params.map(text => ({ type: 'text', text })),
    }] : []

    const res = await fetch(`${GRAPH_URL}/${phoneId()}/messages`, {
      method:  'POST',
      headers: headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name:     templateName,
          language: { code: languageCode },
          components,
        },
      }),
    })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) {
      console.error('[WA] sendTemplateMessage failed:', JSON.stringify(json).slice(0, 200))
      return false
    }
    return true
  } catch (err) {
    console.error('[WA] sendTemplateMessage error:', err)
    return false
  }
}

export async function markAsRead(messageId: string): Promise<void> {
  try {
    await fetch(`${GRAPH_URL}/${phoneId()}/messages`, {
      method:  'POST',
      headers: headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status:     'read',
        message_id: messageId,
      }),
    })
  } catch {
    // non-critical, ignore
  }
}

export async function sendTypingIndicator(to: string): Promise<void> {
  // WhatsApp Business API does not expose a standalone "typing" status endpoint.
  // The closest is sending a read receipt immediately, which implicitly signals activity.
  // Some implementations send a very short text and then the real message, but that
  // creates noise. We simply mark-as-read to show the user we received their message.
  // The real response follows within seconds.
  // Kept as explicit no-op so callers document intent without side effects.
  void to
}

// ── Multi-message send ─────────────────────────────────────────────────────

export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text]

  const parts: string[] = []
  let remaining = text

  while (remaining.length > maxLen) {
    // Prefer splitting at a newline, then at a sentence end
    let splitAt = -1
    const newline = remaining.lastIndexOf('\n', maxLen)
    const period  = remaining.lastIndexOf('. ', maxLen)
    const excl    = remaining.lastIndexOf('! ', maxLen)
    const quest   = remaining.lastIndexOf('? ', maxLen)

    const candidates = [newline, period, excl, quest].filter(n => n > maxLen * 0.5)
    splitAt = candidates.length > 0 ? Math.max(...candidates) : maxLen

    // newline: include the newline; sentence end: include space
    const chunk = remaining.slice(0, splitAt + 1).trim()
    if (chunk) parts.push(chunk)
    remaining = remaining.slice(splitAt + 1).trim()
  }

  if (remaining) parts.push(remaining)
  return parts
}

export async function sendMultipartMessage(to: string, text: string): Promise<boolean> {
  const parts = splitMessage(text)
  let allOk = true
  for (let i = 0; i < parts.length; i++) {
    const ok = await sendTextMessage(to, parts[i])
    if (!ok) allOk = false
    if (i < parts.length - 1) {
      await new Promise(r => setTimeout(r, 600))
    }
  }
  return allOk
}

// ── WhatsApp markdown sanitiser ────────────────────────────────────────────
// WA supports *bold*, _italic_, ~strikethrough~, `code`, ```preformatted```
// Strip HTML-style and standard markdown that WA doesn't render

export function sanitiseForWhatsApp(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, '*$1*')        // **bold** → *bold*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')          // # Heading → *Heading*
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2') // [text](url) → text: url
    .replace(/`{3}[\s\S]*?`{3}/g, '')              // ```code blocks``` → remove
    .replace(/(?<!\*)`([^`]+)`(?!\*)/g, '$1')      // `inline code` → plain
    .replace(/---+/g, '—')                          // horizontal rules → em dash
    .trim()
}
