import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  notifyAdvertiserApproved,
  notifyAdvertiserRejected,
} from '@/lib/ads/adNotifications'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending_review'
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const limit  = parseInt(searchParams.get('limit') ?? '20', 10)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const admin = createAdminClient()

  const { data, error, count } = await admin
    .from('ad_campaigns')
    .select(`
      *,
      advertiser:advertiser_id (id, business_name, contact_phone, whatsapp_number, email, city, status),
      plan:plan_id (name, ad_type, price_tzs, duration_days)
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data ?? [], total: count ?? 0, page, limit })
}

// Bulk action: approve / reject multiple campaigns
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { ids, action, reason } = body as { ids: string[]; action: 'approve' | 'reject'; reason?: string }

  if (!ids?.length || !action) {
    return NextResponse.json({ error: 'ids na action zinahitajika' }, { status: 400 })
  }
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action lazima iwe approve au reject' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: campaigns } = await admin
    .from('ad_campaigns')
    .select('id, ad_type, payment_status, plan:plan_id (duration_days), advertiser:advertiser_id (business_name, whatsapp_number)')
    .in('id', ids)

  if (action === 'reject') {
    const { error } = await admin.from('ad_campaigns').update({
      status: 'rejected', admin_note: reason || null, updated_at: new Date().toISOString(),
    }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Approve per-campaign: activate immediately if already paid, else just approve
    const now = new Date()
    for (const c of campaigns ?? []) {
      const alreadyPaid  = c.payment_status === 'completed'
      const durationDays = (c.plan as unknown as { duration_days?: number } | null)?.duration_days ?? 30
      const approveData  = alreadyPaid
        ? {
            status: 'active', admin_note: reason || null,
            starts_at: now.toISOString(),
            expires_at: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now.toISOString(),
          }
        : { status: 'approved', admin_note: reason || null, updated_at: now.toISOString() }
      await admin.from('ad_campaigns').update(approveData).eq('id', c.id)
    }
  }

  // Send notifications (non-blocking)
  for (const c of campaigns ?? []) {
    const adv = c.advertiser as unknown as { business_name: string; whatsapp_number: string | null }
    if (adv?.whatsapp_number) {
      if (action === 'approve') {
        notifyAdvertiserApproved(adv.whatsapp_number, adv.business_name, c.ad_type).catch(() => {})
      } else {
        notifyAdvertiserRejected(adv.whatsapp_number, adv.business_name, reason ?? 'Haifikii vigezo vyetu').catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, updated: ids.length })
}
