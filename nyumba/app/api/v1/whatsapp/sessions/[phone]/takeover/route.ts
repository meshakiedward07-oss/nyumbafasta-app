import { NextRequest, NextResponse } from 'next/server'
import { updateWASession, saveWAMessage, getOrCreateWASession } from '@/lib/whatsapp/sessionManager'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { logStaffActivity } from '@/lib/staff/checkPermission'

// POST /api/v1/whatsapp/sessions/[phone]/takeover
export async function POST(
  _req: NextRequest,
  { params }: { params: { phone: string } },
) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response
    const actor = { id: auth.userId, full_name: auth.fullName }

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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/whatsapp/sessions/[phone]/takeover]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
