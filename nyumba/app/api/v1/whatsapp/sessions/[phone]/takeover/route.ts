import { NextRequest, NextResponse } from 'next/server'
import { updateWASession, saveWAMessage, getOrCreateWASession } from '@/lib/whatsapp/sessionManager'
import { requireWhatsAppSupportUser } from '@/lib/security/adminAuth'
import { logStaffActivity } from '@/lib/staff/checkPermission'

// POST /api/v1/whatsapp/sessions/[phone]/takeover
export async function POST(
  _req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const actor = await requireWhatsAppSupportUser()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)

  await getOrCreateWASession(phone)
  await updateWASession(phone, {
    status: 'admin',
    assigned_admin_id: actor.id,
  })

  await saveWAMessage(
    phone,
    'outbound',
    'system',
    `${actor.full_name ?? 'Staff'} amechukua mazungumzo haya.`,
  )

  logStaffActivity({
    staffId:      actor.id,
    actionType:   'whatsapp_takeover',
    resourceType: 'whatsapp_sessions',
    resourceId:   phone,
    description:  `Alichukua mazungumzo ya ${phone} kutoka kwa Amina`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, status: 'admin' })
}
