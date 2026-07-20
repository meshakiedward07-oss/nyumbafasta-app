import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  // Fetch this email + its whole thread
  const { data: email } = await admin
    .from('emails')
    .select('*')
    .eq('id', id)
    .single()

  if (!email) return NextResponse.json({ error: 'Barua pepe haikupatikana' }, { status: 404 })

  const { data: thread } = await admin
    .from('emails')
    .select('id,direction,subject,body_text,from_email,from_name,to_email,to_name,status,sent_by_name,created_at')
    .eq('thread_id', email.thread_id as string)
    .order('created_at', { ascending: true })

  return NextResponse.json({ email, thread: thread ?? [] })
}
