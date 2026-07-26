import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/brokerage-commissions?status=&search=&page=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin  = createAdminClient()
    const url    = req.nextUrl
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')?.trim()
    const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
    const limit  = 25

    let query = admin
      .from('brokerage_commissions')
      .select(`
        id, calculated_amount, collection_status, invoice_sent_at,
        collected_at, proof_url, notes, created_at, updated_at,
        listing:listings!listing_id(id, title, district, region, type, status),
        landlord:users!landlord_id(id, full_name, phone, email),
        staff:users!staff_id(id, full_name),
        rule:commission_rules!rule_id(id, rule_type, value, description)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status) query = query.eq('collection_status', status)

    const { data, count, error } = await query
    if (error) throw error

    let rows = data ?? []
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => {
        const listing  = r.listing  as unknown as { title: string; district: string } | null
        const landlord = r.landlord as unknown as { full_name: string | null; phone: string | null } | null
        return (
          (listing?.title       ?? '').toLowerCase().includes(q) ||
          (listing?.district    ?? '').toLowerCase().includes(q) ||
          (landlord?.full_name  ?? '').toLowerCase().includes(q) ||
          (landlord?.phone      ?? '').toLowerCase().includes(q)
        )
      })
    }

    // Summary totals (all records, no filter)
    const { data: allRows } = await admin
      .from('brokerage_commissions')
      .select('calculated_amount, collection_status, collected_at')

    const now       = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const summary = {
      total_pending:         (allRows ?? []).filter(r => r.collection_status === 'pending').reduce((s, r) => s + (r.calculated_amount ?? 0), 0),
      total_invoiced:        (allRows ?? []).filter(r => r.collection_status === 'invoiced').reduce((s, r) => s + (r.calculated_amount ?? 0), 0),
      total_collected_month: (allRows ?? []).filter(r => r.collection_status === 'collected' && r.collected_at && r.collected_at >= monthStart).reduce((s, r) => s + (r.calculated_amount ?? 0), 0),
      overdue_count:         (allRows ?? []).filter(r => r.collection_status === 'overdue').length,
      pending_count:         (allRows ?? []).filter(r => r.collection_status === 'pending').length,
      invoiced_count:        (allRows ?? []).filter(r => r.collection_status === 'invoiced').length,
    }

    return NextResponse.json({ commissions: rows, total: count ?? 0, page, summary })
  } catch (err) {
    console.error('[GET /admin/brokerage-commissions]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/brokerage-commissions — manually create a commission record
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const body  = await req.json()
    const { listing_id, landlord_id, staff_id, calculated_amount, notes } = body

    if (!listing_id)   return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
    if (!landlord_id)  return NextResponse.json({ error: 'landlord_id inahitajika' }, { status: 400 })
    if (!calculated_amount || Number(calculated_amount) <= 0) {
      return NextResponse.json({ error: 'Kiasi cha kamisheni kinahitajika' }, { status: 400 })
    }

    // Get active rule
    const { data: rule } = await admin
      .from('commission_rules')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data, error } = await admin
      .from('brokerage_commissions')
      .insert({
        listing_id,
        landlord_id,
        staff_id:          staff_id || auth.userId,
        rule_id:           rule?.id ?? null,
        calculated_amount: Number(calculated_amount),
        collection_status: 'pending',
        notes:             notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ commission: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/brokerage-commissions]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
