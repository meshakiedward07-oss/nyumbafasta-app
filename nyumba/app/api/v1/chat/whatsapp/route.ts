import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'nyumbafasta-whatsapp-webhook' })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const from = (formData.get('From') as string) ?? ''
    const userId = from.replace('whatsapp:', '')
    const body = (formData.get('Body') as string) ?? ''
    const profileName = (formData.get('ProfileName') as string) ?? ''

    const numMedia = parseInt((formData.get('NumMedia') as string) ?? '0', 10)
    const mediaUrls: string[] = []
    for (let i = 0; i < numMedia; i++) {
      const url = formData.get(`MediaUrl${i}`) as string
      if (url) mediaUrls.push(url)
    }

    console.log(`[WhatsApp] from=${userId} body="${body.slice(0, 80)}"`)

    const response = await handleIncomingMessage(
      'whatsapp',
      userId,
      body,
      userId,
      profileName || undefined,
      mediaUrls.length > 0 ? mediaUrls : undefined,
    )

    // Escape special XML chars
    const safe = response
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`

    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    const errTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Samahani, kuna tatizo la kiufundi. Jaribu tena. 🙏</Message></Response>`
    return new Response(errTwiml, { headers: { 'Content-Type': 'text/xml' } })
  }
}
