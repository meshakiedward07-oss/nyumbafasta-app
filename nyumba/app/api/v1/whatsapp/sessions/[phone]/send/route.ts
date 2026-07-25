import { NextRequest, NextResponse } from 'next/server'
import { sendMultipartMessage } from '@/lib/whatsapp/client'
import { getWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireStaffAuth } from '@/lib/security/adminAuth'

// POST /api/v1/whatsapp/sessions/[phone]/send
// Body: { message: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response
    const actor = { id: auth.userId, full_name: auth.fullName }

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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/whatsapp/sessions/[phone]/send]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
