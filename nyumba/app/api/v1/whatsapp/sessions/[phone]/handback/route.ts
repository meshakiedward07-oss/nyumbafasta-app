import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { updateWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'
import { requireStaffAuth } from '@/lib/security/adminAuth'

// POST /api/v1/whatsapp/sessions/[phone]/handback
// Body: { note?: string }   — optional instruction for Amina
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response
    const admin = { id: auth.userId, full_name: auth.fullName }

    const phone = decodeURIComponent(params.phone)
    const { note } = await req.json().catch(() => ({ note: undefined })) as { note?: string }

    await updateWASession(phone, {
      status: 'amina',
      assigned_admin_id: null,
    })

    // If admin left a note, add it as a phone-specific instruction for Amina
    if (note?.trim()) {
      await supabaseAdmin.from('amina_instructions').insert({
        admin_id:    admin.id,
        instruction: note.trim(),
        scope:       'phone_specific',
        phone_number: phone,
        active:      true,
      })
    }

    await saveWAMessage(
      phone,
      'outbound',
      'system',
      `Mazungumzo yamerudishwa kwa Amina na ${admin.full_name ?? 'Admin'}.${note ? ` Maelezo: "${note}"` : ''}`,
    )

    return NextResponse.json({ ok: true, status: 'amina' })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/whatsapp/sessions/[phone]/handback]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
