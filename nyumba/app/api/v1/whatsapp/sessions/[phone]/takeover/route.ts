import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateWASession, saveWAMessage, getOrCreateWASession } from '@/lib/whatsapp/sessionManager'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'

async function getAuthorisedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, staff_active, full_name').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(data?.role ?? '')) return null
  if (data?.role === 'staff') {
    if (data?.staff_active === false) return null
    const allowed = await hasPermission(user.id, 'whatsapp_support')
    if (!allowed) return null
  }
  return { ...user, full_name: data?.full_name as string, role: data?.role as string }
}

// POST /api/v1/whatsapp/sessions/[phone]/takeover
export async function POST(
  _req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const actor = await getAuthorisedUser()
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

  // Log activity for accountability
  logStaffActivity({
    staffId:      actor.id,
    actionType:   'whatsapp_takeover',
    resourceType: 'whatsapp_sessions',
    resourceId:   phone,
    description:  `Alichukua mazungumzo ya ${phone} kutoka kwa Amina`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, status: 'admin' })
}
