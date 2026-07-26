import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/kyc?status=&search=&page=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const url    = req.nextUrl
    const status = url.searchParams.get('status')   // pending|approved|rejected|needs_more_info
    const search = url.searchParams.get('search')?.trim()
    const page   = parseInt(url.searchParams.get('page') ?? '1')
    const limit  = 20

    let query = admin
      .from('kyc_submissions')
      .select(`
        id, status, submitted_at, reviewed_at, notes, rejection_reason,
        id_document_url, title_deed_url, tax_cert_url,
        landlord:users!landlord_id(id, full_name, phone, email, avatar_url),
        reviewer:users!reviewed_by(id, full_name),
        service_request:service_requests!service_request_id(
          id, request_type, status, listing_id,
          listing:listings(id, title, region, district)
        )
      `, { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
    if (error) throw error

    // Filter by landlord name/phone in memory (Supabase doesn't support joined column filter directly)
    let rows = data ?? []
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => {
        const landlord = r.landlord as unknown as { full_name: string | null; phone: string | null; email: string | null } | null
        return (
          (landlord?.full_name ?? '').toLowerCase().includes(q) ||
          (landlord?.phone    ?? '').toLowerCase().includes(q) ||
          (landlord?.email    ?? '').toLowerCase().includes(q)
        )
      })
    }

    // Summary counts
    const [pendingRes, approvedRes, rejectedRes, needsMoreRes] = await Promise.all([
      admin.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      admin.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      admin.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'needs_more_info'),
    ])

    return NextResponse.json({
      submissions: rows,
      total:       count ?? 0,
      page,
      summary: {
        pending:        pendingRes.count  ?? 0,
        approved:       approvedRes.count ?? 0,
        rejected:       rejectedRes.count ?? 0,
        needs_more_info: needsMoreRes.count ?? 0,
      },
    })
  } catch (err) {
    console.error('[GET /admin/kyc]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
