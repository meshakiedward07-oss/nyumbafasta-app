import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ad_payments')
    .select('id, status, amount, paid_at, campaign_id, gateway_reference')
    .eq('id', id)
    .eq('advertiser_id', auth.advertiser.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Malipo hayakupatikana' }, { status: 404 })
  return NextResponse.json({ payment: data })
}
