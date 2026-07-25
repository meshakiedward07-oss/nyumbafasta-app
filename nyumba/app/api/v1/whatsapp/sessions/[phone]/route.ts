import { NextRequest, NextResponse } from 'next/server'
import { getWASession, getWAMessages } from '@/lib/whatsapp/sessionManager'
import { requireStaffAuth } from '@/lib/security/adminAuth'

// GET /api/v1/whatsapp/sessions/[phone] — full conversation history
export async function GET(
  _req: NextRequest,  // eslint-disable-line @typescript-eslint/no-unused-vars
  { params }: { params: { phone: string } },
) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const phone = decodeURIComponent(params.phone)
  const [session, messages] = await Promise.all([
    getWASession(phone),
    getWAMessages(phone, 100),
  ])

  return NextResponse.json({ session, messages })
}
