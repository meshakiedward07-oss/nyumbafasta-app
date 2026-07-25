import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('ad_campaigns')
      .select('*, plan:plan_id (*)')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    return NextResponse.json({ campaign: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('ad_campaigns')
      .select('id, status')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    if (existing.status === 'active') {
      return NextResponse.json({ error: 'Kampeni inayoendelea haiwezi kubadilishwa' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['title', 'body_text', 'image_url', 'video_url', 'cta_type', 'cta_value',
                     'target_region', 'target_district', 'target_category']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
    }

    // Re-queue rejected campaigns for review when the owner edits them
    if (existing.status === 'rejected') {
      updates.status    = 'pending_review'
      updates.admin_note = null
    }

    const { data, error } = await admin
      .from('ad_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaign: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('ad_campaigns')
      .select('id, status, payment_status')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    if (existing.payment_status === 'completed') {
      return NextResponse.json({ error: 'Kampeni iliyolipwa haiwezi kufutwa. Wasiliana na msaada.' }, { status: 403 })
    }

    const { error } = await admin.from('ad_campaigns').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
