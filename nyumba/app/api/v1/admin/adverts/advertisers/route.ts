import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET — all advertisers with campaign stats
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'all'
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const limit  = parseInt(searchParams.get('limit') ?? '30', 10)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const admin = createAdminClient()

  let query = admin
    .from('advertisers')
    .select(`
      id, business_name, business_category, contact_phone, whatsapp_number,
      email, city, district, description, logo_url, website_url,
      status, rejection_reason, created_at, updated_at,
      reviewed_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch campaign counts per advertiser in one query
  const ids = (data ?? []).map(a => a.id)
  let campaignCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: counts } = await admin
      .from('ad_campaigns')
      .select('advertiser_id')
      .in('advertiser_id', ids)

    for (const row of counts ?? []) {
      campaignCounts[row.advertiser_id] = (campaignCounts[row.advertiser_id] ?? 0) + 1
    }
  }

  const advertisers = (data ?? []).map(a => ({
    ...a,
    campaign_count: campaignCounts[a.id] ?? 0,
  }))

  return NextResponse.json({ advertisers, total: count ?? 0, page, limit })
}

// PATCH — approve, reject, or suspend an advertiser
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id, action, reason } = body as { id: string; action: string; reason?: string }

  if (!id || !action) {
    return NextResponse.json({ error: 'id na action zinahitajika' }, { status: 400 })
  }
  if (!['approve', 'reject', 'suspend', 'activate'].includes(action)) {
    return NextResponse.json({ error: 'action haijulikani' }, { status: 400 })
  }

  const admin = createAdminClient()

  const statusMap: Record<string, string> = {
    approve:  'active',
    reject:   'rejected',
    suspend:  'suspended',
    activate: 'active',
  }

  const updates: Record<string, unknown> = {
    status:      statusMap[action],
    updated_at:  new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }
  if (action === 'reject') updates.rejection_reason = reason ?? null
  if (action === 'activate') updates.rejection_reason = null

  const { data, error } = await admin
    .from('advertisers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, advertiser: data })
}
