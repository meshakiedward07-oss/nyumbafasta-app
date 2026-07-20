import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const direction = searchParams.get('direction') ?? 'outbound' // 'outbound' | 'inbound'
  const q         = searchParams.get('q') ?? ''
  const type      = searchParams.get('type') ?? 'all' // 'all' | 'client' | 'dalali' | 'advertiser'
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage   = 25
  const from      = (page - 1) * perPage
  const to        = from + perPage - 1

  const admin = createAdminClient()

  let query = admin
    .from('emails')
    .select('id,thread_id,direction,subject,body_text,from_email,from_name,to_email,to_name,recipient_type,sent_by_name,status,created_at', { count: 'exact' })
    .eq('direction', direction)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type !== 'all') {
    query = query.eq('recipient_type', type)
  }
  if (q.trim()) {
    query = query.or(`subject.ilike.%${q}%,to_email.ilike.%${q}%,to_name.ilike.%${q}%,from_email.ilike.%${q}%,from_name.ilike.%${q}%`)
  }

  const { data: emails, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ emails: emails ?? [], total: count ?? 0, page, perPage })
}
