import { NextRequest, NextResponse } from 'next/server'
import { handleWhatsAppMessage } from '@/lib/whatsapp/aminaHandler'
import { sendMultipartMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

/**
 * POST /api/v1/whatsapp/test
 * Secured endpoint to manually test Amina + WhatsApp sending.
 * Requires: { phone, message } in body + Authorization: Bearer <WHATSAPP_TOKEN>
 */
export async function POST(req: NextRequest) {
  // Require admin token for safety
  const auth = req.headers.get('authorization') ?? ''
  const adminSecret = process.env.ADMIN_SECRET ?? process.env.WHATSAPP_TOKEN
  if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { phone?: string; message?: string; send?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, message, send = false } = body
  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }

  const from      = formatPhoneNumber(phone)
  const messageId = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    const response = await handleWhatsAppMessage(from, message, messageId, 'TestUser')

    if (send && response) {
      await sendMultipartMessage(from, response)
      return NextResponse.json({ from, messageId, response, sent: true })
    }

    return NextResponse.json({ from, messageId, response, sent: false })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
