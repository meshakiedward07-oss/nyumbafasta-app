import { NextRequest, NextResponse } from 'next/server'
import { getWASession, getWAMessages } from '@/lib/whatsapp/sessionManager'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/whatsapp/sessions/[phone] — full conversation history
export async function GET(
  _req: NextRequest,  // eslint-disable-line @typescript-eslint/no-unused-vars
  { params }: { params: { phone: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)
  const [session, messages] = await Promise.all([
    getWASession(phone),
    getWAMessages(phone, 100),
  ])

  return NextResponse.json({ session, messages })
}
