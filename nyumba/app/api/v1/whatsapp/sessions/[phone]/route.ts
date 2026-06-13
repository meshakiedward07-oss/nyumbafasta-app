import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWASession, getWAMessages } from '@/lib/whatsapp/sessionManager'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/whatsapp/sessions/[phone] — full conversation history
export async function GET(
  _req: NextRequest,  // eslint-disable-line @typescript-eslint/no-unused-vars
  { params }: { params: { phone: string } },
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const phone = decodeURIComponent(params.phone)
  const [session, messages] = await Promise.all([
    getWASession(phone),
    getWAMessages(phone, 100),
  ])

  return NextResponse.json({ session, messages })
}
