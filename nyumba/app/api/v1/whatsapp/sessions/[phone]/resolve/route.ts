import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return { ...user, full_name: data.full_name as string }
}

// POST /api/v1/whatsapp/sessions/[phone]/resolve
export async function POST(
  _req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const admin = await getAdminUser()
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
