import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  notifyAdvertiserApproved,
  notifyAdvertiserRejected,
} from '@/lib/ads/adNotifications'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ad_campaigns')
    .select(`
      *,
      advertiser:advertiser_id (*),
      plan:plan_id (*),
      payments:ad_payments (id, amount, status, paid_at, provider, phone_number)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
  return NextResponse.json({ campaign: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { action, reason, status, admin_note } = body

  const admin = createAdminClient()

  // Load campaign for notification data
  const { data: campaign } = await admin
    .from('ad_campaigns')
    .select('id, ad_type, advertiser:advertiser_id (business_name, whatsapp_number)')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })

  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'approve') {
    updates = { ...updates, status: 'approved', admin_note: reason || null }
  } else if (action === 'reject') {
    updates = { ...updates, status: 'rejected', admin_note: reason || null }
  } else if (action === 'suspend') {
    updates = { ...updates, status: 'suspended', admin_note: reason || null }
  } else if (action === 'activate') {
    updates = { ...updates, status: 'active' }
  } else if (status) {
    updates = { ...updates, status }
  }

  if (admin_note !== undefined) updates.admin_note = admin_note

  const { data, error } = await admin
    .from('ad_campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // WhatsApp notifications
  const adv = campaign.advertiser as unknown as { business_name: string; whatsapp_number: string | null }
  if (adv?.whatsapp_number) {
    if (action === 'approve') {
      notifyAdvertiserApproved(adv.whatsapp_number, adv.business_name, campaign.ad_type).catch(() => {})
    } else if (action === 'reject') {
      notifyAdvertiserRejected(adv.whatsapp_number, adv.business_name, reason ?? 'Haifikii vigezo vyetu').catch(() => {})
    }
  }

  return NextResponse.json({ campaign: data })
}
