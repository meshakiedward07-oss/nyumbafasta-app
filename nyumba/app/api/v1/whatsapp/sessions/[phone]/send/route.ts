import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMultipartMessage } from '@/lib/whatsapp/client'
import { saveWAMessage } from '@/lib/whatsapp/sessionManager'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return { ...user, full_name: data.full_name as string }
}

// POST /api/v1/whatsapp/sessions/[phone]/send
// Body: { message: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)
  const { message } = await req.json() as { message: string }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const text = message.trim()

  // Send via Meta API
  await sendMultipartMessage(phone, text)

  // Save to admin panel message store
  await saveWAMessage(phone, 'outbound', 'admin', text, undefined, {
    sent_by: admin.id,
    sent_by_name: admin.full_name,
  })

  return NextResponse.json({ ok: true })
}
