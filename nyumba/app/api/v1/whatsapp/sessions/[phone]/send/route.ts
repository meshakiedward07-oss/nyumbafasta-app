import { NextRequest, NextResponse } from 'next/server'
import { sendMultipartMessage } from '@/lib/whatsapp/client'
import { saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireAdminUser } from '@/lib/security/adminAuth'

// POST /api/v1/whatsapp/sessions/[phone]/send
// Body: { message: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)
  const { message } = await req.json() as { message: string }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const text = message.trim()

  // Send via Meta API
  await sendMultipartMessage(phone, text)

  // Save to admin panel message store
  await saveWAMessage(phone, 'outbound', 'admin', text, undefined, {
    sent_by: admin.id,
    sent_by_name: admin.full_name,
  })

  return NextResponse.json({ ok: true })
}
