import { NextRequest, NextResponse } from 'next/server'
import { updateWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/v1/whatsapp/sessions/[phone]/resolve
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  const { phone: rawPhone } = await params
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response
    const admin = { id: auth.userId, full_name: auth.fullName }

    const phone = decodeURIComponent(rawPhone)

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

    // Mark all handover-layer miss-log entries for this phone as reviewed
    // so they don't show up in the admin learning loop as pending patterns.
    void createAdminClient()
      .from('cascade_miss_log')
      .update({ reviewed: true })
      .eq('phone_number', phone)
      .eq('handover_triggered', true)
      .eq('reviewed', false)
      .then(() => null, () => null)

    return NextResponse.json({ ok: true, status: 'resolved' })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/whatsapp/sessions/[phone]/resolve]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
