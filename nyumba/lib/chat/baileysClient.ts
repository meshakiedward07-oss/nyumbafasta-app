const WHATSAPP_SERVICE =
  process.env.WHATSAPP_SERVICE_URL ?? 'https://nyumbafasta-whatsapp.fly.dev'

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return false
  }
}

export async function broadcastWhatsApp(
  phones: string[],
  message: string,
): Promise<{ success: boolean; sent?: number } | null> {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones, message }),
    })
    return await res.json()
  } catch (err) {
    console.error('Broadcast error:', err)
    return null
  }
}

export async function isWhatsAppConnected(): Promise<boolean> {
  try {
    const res = await fetch(`${WHATSAPP_SERVICE}/status`)
    const data = await res.json()
    return data.connected === true
  } catch {
    return false
  }
}
