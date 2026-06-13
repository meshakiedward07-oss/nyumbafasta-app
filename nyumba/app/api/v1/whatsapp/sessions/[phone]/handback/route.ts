import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { updateWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return { ...user, full_name: data.full_name as string }
}

// POST /api/v1/whatsapp/sessions/[phone]/handback
// Body: { note?: string }   — optional instruction for Amina
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
}
