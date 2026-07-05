import { NextRequest, NextResponse } from 'next/server'
import { sendMultipartMessage } from '@/lib/whatsapp/client'
import { getWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireWhatsAppSupportUser } from '@/lib/security/adminAuth'

// POST /api/v1/whatsapp/sessions/[phone]/send
// Body: { message: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const actor = await requireWhatsAppSupportUser()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)

  // Enforce: only send when admin has taken over — prevents double-replies from Amina
  const session = await getWASession(phone)
  if (!session || session.status !== 'admin') {
    return NextResponse.json(
      { error: 'Haiwezekani kutuma: mazungumzo hayako chini ya udhibiti wa admin' },
      { status: 409 },
    )
  }

  const { message } = await req.json() as { message: string }
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const text = message.trim()

  // Send via Meta API — check for failure
  const sent = await sendMultipartMessage(phone, text)
  if (!sent) {
    return NextResponse.json({ error: 'Imeshindwa kutuma ujumbe kwa Meta API' }, { status: 502 })
  }

  // Save to admin panel message store only after confirmed send
  await saveWAMessage(phone, 'outbound', 'admin', text, undefined, {
    sent_by:      actor.id,
    sent_by_name: actor.full_name,
  })

  return NextResponse.json({ ok: true })
}
