import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { requirePermission } from '@/lib/staff/checkPermission'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    // 'communications' permission gate — see email/send/route.ts's comment.
    // This route lets any caller read the FULL email history of every
    // client/dalali/advertiser, so it needs the same gate as sending does.
    const perm = await requirePermission(auth.userId, 'communications')
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

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
    // See email/contacts/route.ts for why `,()` are stripped: PostgREST's
    // .or() treats them as filter syntax (OR-separator / grouping), so an
    // unescaped q can inject extra clauses instead of just being matched
    // as search text. Found 2026-09-01 compose-email audit.
    const safeQ = q.trim().replace(/[,()]/g, '')
    if (safeQ) {
      query = query.or(`subject.ilike.%${safeQ}%,to_email.ilike.%${safeQ}%,to_name.ilike.%${safeQ}%,from_email.ilike.%${safeQ}%,from_name.ilike.%${safeQ}%`)
    }

    const { data: emails, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ emails: emails ?? [], total: count ?? 0, page, perPage })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/email/list]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
