import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const VALID_REASONS = [
  'Anaomba pesa nje ya app',
  'Picha ni fake',
  'Nyumba haipatikani',
  'Nambari si ya kweli',
  'Unyanyasaji wa wateja',
  'Sababu nyingine',
]

const AUTO_SUSPEND_THRESHOLD = 3

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { reason, details } = await req.json()
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Sababu si sahihi' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get listing + dalali
    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id')
      .eq('id', params.id)
      .single()

    if (!listing) {
      return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
    }

    // Prevent dalali from reporting themselves
    if (listing.dalali_id === user.id) {
      return NextResponse.json({ error: 'Huwezi kujiripoti mwenyewe' }, { status: 400 })
    }

    // Check if user already reported this listing
    const { data: existing } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('listing_id', params.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Umeshakuwa umeripoti listing hii' }, { status: 400 })
    }

    // Insert report
    const { error: insertError } = await admin.from('reports').insert({
      reporter_id:        user.id,
      reported_dalali_id: listing.dalali_id,
      listing_id:         params.id,
      reason,
      details:            details?.slice(0, 500) ?? null,
      status:             'pending',
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Auto-suspend check: count pending reports for this dalali
    const { count } = await admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_dalali_id', listing.dalali_id)
      .eq('status', 'pending')

    if ((count ?? 0) >= AUTO_SUSPEND_THRESHOLD) {
      await admin.from('users').update({ is_active: false }).eq('id', listing.dalali_id)

      // Notify admins
      const { data: admins } = await admin
        .from('users')
        .select('id')
        .eq('role', 'admin')

      if (admins?.length) {
        const { data: dalali } = await admin
          .from('users')
          .select('full_name')
          .eq('id', listing.dalali_id)
          .single()

        await admin.from('notifications').insert(
          admins.map(a => ({
            user_id:  a.id,
            title:    '⚠️ Dalali Amesuspended Automatically',
            body:     `${dalali?.full_name ?? 'Dalali'} amesuspended baada ya ripoti ${count} — angalia Admin Panel`,
            type:     'admin_alert',
            is_read:  false,
          }))
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
