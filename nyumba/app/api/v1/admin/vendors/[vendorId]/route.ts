import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { vendorId: string } }

// PATCH /api/v1/admin/vendors/:vendorId — verify or reject vendor
export async function PATCH(req: NextRequest, { params }: Params) {
  const { vendorId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const body = await req.json()
    const { action, rejection_reason } = body
    if (action !== 'verify' && action !== 'reject') {
      return NextResponse.json({ error: 'action lazima iwe verify au reject' }, { status: 400 })
    }

    const { data: existing } = await admin.from('vendors').select('id, org_id, name').eq('id', vendorId).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Mchezaji hapatikani' }, { status: 404 })

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: now }

    if (action === 'verify') {
      updates.verification_status = 'verified'
      updates.verified_by         = user.id
      updates.verified_at         = now
      updates.rejection_reason    = null
    } else {
      updates.verification_status = 'rejected'
      updates.rejection_reason    = rejection_reason?.trim() || null
      updates.verified_by         = null
      updates.verified_at         = null
    }

    const { data: vendor, error } = await admin.from('vendors').update(updates).eq('id', vendorId).select().single()
    if (error) throw error

    // Notify org owner
    ;(async () => {
      try {
        const { data: org } = await admin.from('organizations').select('created_by, name').eq('id', existing.org_id).maybeSingle()
        if (!org?.created_by) return
        const title = action === 'verify' ? 'Mchezaji Amethibitishwa ✓' : 'Mchezaji Alikataliwa'
        const notifBody = action === 'verify'
          ? `${existing.name} amethibitishwa. Sasa anaonekana kwenye orodha ya wachuuzi wako.`
          : `${existing.name} alikataliwa.${rejection_reason?.trim() ? ' Sababu: ' + rejection_reason.trim() : ''}`
        await admin.from('notifications').insert({
          user_id: org.created_by,
          type:    action === 'verify' ? 'vendor_verified' : 'vendor_rejected',
          title,
          body:    notifBody,
          data:    { vendor_id: vendorId, org_id: existing.org_id },
          read:    false,
        })
      } catch { /* non-fatal */ }
    })().catch(() => {})

    return NextResponse.json({ vendor })
  } catch (err) {
    console.error('[PATCH /admin/vendors/:vendorId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
