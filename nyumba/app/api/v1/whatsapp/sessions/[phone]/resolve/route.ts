import { NextRequest, NextResponse } from 'next/server'
import { updateWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireAdminUser } from '@/lib/security/adminAuth'

// POST /api/v1/whatsapp/sessions/[phone]/resolve
export async function POST(
  _req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)

  await updateWASession(phone, {
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    assigned_admin_id: null,
  })

  await saveWAMessage(
    phone,
    'outbound',
    'system',
    `Tatizo limeshughulikiwa na ${admin.full_name ?? 'Admin'}. Mazungumzo yamefungwa.`,
  )

  return NextResponse.json({ ok: true, status: 'resolved' })
}
