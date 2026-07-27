import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/brokerage-requests
// Fleet view of all brokerage requests across all orgs, with summary stats.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const admin  = createAdminClient()
    const url    = req.nextUrl
    const status = url.searchParams.get('status') ?? ''
    const search = url.searchParams.get('q')?.trim() ?? ''
    const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    let query = admin
      .from('brokerage_requests')
      .select(`
        id, title, listing_type, price_monthly, deposit_months,
        region, district, images, org_contact_name, org_contact_phone,
        status, commission_status, commission_amount,
        rejection_reason, agreed_at, posted_at, deal_closed_at, created_at, updated_at,
        org:organizations!org_id(id, name, phone),
        submitter:users!submitted_by(id, full_name, phone),
        poster:users!posted_by(id, full_name),
        listing:listings!listing_id(id, title, status, lifecycle_status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
    if (error) throw error

    let rows = data ?? []
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => {
        const org  = r.org  as unknown as { name: string } | null
        const sub  = r.submitter as unknown as { full_name: string | null; phone: string | null } | null
        return (
          r.title.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          (org?.name ?? '').toLowerCase().includes(q) ||
          (sub?.full_name ?? '').toLowerCase().includes(q) ||
          (r.org_contact_phone ?? '').includes(q)
        )
      })
    }

    // Summary stats (all statuses)
    const { data: all } = await admin
      .from('brokerage_requests')
      .select('status, commission_status, commission_amount')

    const allRows = all ?? []
    const summary = {
      pending:           allRows.filter(r => r.status === 'pending').length,
      approved:          allRows.filter(r => r.status === 'approved').length,
      listed:            allRows.filter(r => r.status === 'listed').length,
      deal_closed:       allRows.filter(r => r.status === 'deal_closed').length,
      commission_due:    allRows.filter(r => r.status === 'deal_closed' && r.commission_status === 'pending').reduce((s, r) => s + (r.commission_amount ?? 0), 0),
      commission_invoiced: allRows.filter(r => r.commission_status === 'invoiced').reduce((s, r) => s + (r.commission_amount ?? 0), 0),
      commission_received: allRows.filter(r => r.commission_status === 'received').reduce((s, r) => s + (r.commission_amount ?? 0), 0),
    }

    return NextResponse.json({ requests: rows, total: count ?? 0, summary })
  } catch (err) {
    console.error('[GET /admin/brokerage-requests]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
