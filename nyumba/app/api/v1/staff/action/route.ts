import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'
import { sendPushToUser } from '@/lib/notifications/send'

export const dynamic = 'force-dynamic'

type ActionType =
  | 'approve_listing' | 'reject_listing'
  | 'resolve_report'  | 'dismiss_report'
  | 'activate_user'   | 'deactivate_user'
  | 'approve_verification' | 'reject_verification'
  | 'extend_subscription' | 'suspend_subscription'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role, full_name, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile?.role === 'staff' && !profile?.staff_active) {
    return NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 })
  }

  const isAdmin = profile?.role === 'admin'

  let body: { type: ActionType; id: string; reason?: string; days?: number }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { type, id, reason, days } = body
  if (!type || !id) return NextResponse.json({ error: 'type na id vinahitajika' }, { status: 400 })

  // ── APPROVE LISTING ────────────────────────────────────────────────────────
  if (type === 'approve_listing') {
    if (!isAdmin && !await hasPermission(user.id, 'approve_listings')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kuidhinisha listings' }, { status: 403 })
    }
    const { error } = await admin
      .from('listings')
      .update({ status: 'active', expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString() })
      .eq('id', id).eq('status', 'pending')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: listing } = await admin.from('listings').select('dalali_id, type, district').eq('id', id).single()
    if (listing) {
      await Promise.all([
        admin.from('notifications').insert({
          user_id: listing.dalali_id,
          title: '✅ Listing Imeidhibitiwa',
          body: `${listing.type} yako – ${listing.district} imeidhinishwa na inaonekana kwa wateja.`,
          type: 'listing_approved', is_read: false,
        }),
        sendPushToUser(listing.dalali_id, '✅ Listing Imeidhibitiwa', `${listing.type} yako – ${listing.district} imeidhinishwa`, '/dashboard/listings'),
      ])
    }
    await logStaffActivity({ staffId: user.id, actionType: 'approve_listing', resourceType: 'listing', resourceId: id, description: `Ulidhinisha listing #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Listing imeidhinishwa' })
  }

  // ── REJECT LISTING ─────────────────────────────────────────────────────────
  if (type === 'reject_listing') {
    if (!isAdmin && !await hasPermission(user.id, 'approve_listings')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kukataa listings' }, { status: 403 })
    }
    const { error } = await admin
      .from('listings')
      .update({ status: 'rejected' })
      .eq('id', id).eq('status', 'pending')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: listing } = await admin.from('listings').select('dalali_id, type, district').eq('id', id).single()
    if (listing) {
      await Promise.all([
        admin.from('notifications').insert({
          user_id: listing.dalali_id,
          title: '❌ Listing Ilikataliwa',
          body: `${listing.type} yako – ${listing.district} ilikataliwa.${reason ? ` Sababu: ${reason}` : ' Angalia masharti yetu na uirekebisha.'}`,
          type: 'listing_rejected', is_read: false,
        }),
        sendPushToUser(listing.dalali_id, '❌ Listing Ilikataliwa', `${listing.type} yako – ${listing.district} ilikataliwa`, '/dashboard/listings'),
      ])
    }
    await logStaffActivity({ staffId: user.id, actionType: 'reject_listing', resourceType: 'listing', resourceId: id, description: `Ulikataa listing #${id.slice(0, 8)}${reason ? `: ${reason}` : ''}` })
    return NextResponse.json({ ok: true, message: 'Listing imekataliwa' })
  }

  // ── RESOLVE REPORT ─────────────────────────────────────────────────────────
  if (type === 'resolve_report') {
    if (!isAdmin && !await hasPermission(user.id, 'handle_reports')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kushughulikia ripoti' }, { status: 403 })
    }
    const { error } = await admin
      .from('reports')
      .update({ status: 'reviewed', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'resolve_report', resourceType: 'report', resourceId: id, description: `Ulishughulikia ripoti #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Ripoti imeshughulikiwa' })
  }

  // ── DISMISS REPORT ─────────────────────────────────────────────────────────
  if (type === 'dismiss_report') {
    if (!isAdmin && !await hasPermission(user.id, 'handle_reports')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kushughulikia ripoti' }, { status: 403 })
    }
    const { error } = await admin
      .from('reports')
      .update({ status: 'dismissed', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'dismiss_report', resourceType: 'report', resourceId: id, description: `Uliondoa ripoti #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Ripoti imeondolewa' })
  }

  // ── ACTIVATE USER ──────────────────────────────────────────────────────────
  if (type === 'activate_user') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_users')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kusimamia watumiaji' }, { status: 403 })
    }
    const { error } = await admin
      .from('users')
      .update({ is_active: true, account_status: 'active' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'activate_user', resourceType: 'user', resourceId: id, description: `Ulifungua akaunti ya mtumiaji #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Akaunti imefunguliwa' })
  }

  // ── DEACTIVATE USER ────────────────────────────────────────────────────────
  if (type === 'deactivate_user') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_users')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kusimamia watumiaji' }, { status: 403 })
    }
    const { error } = await admin
      .from('users')
      .update({ is_active: false, account_status: 'suspended' })
      .eq('id', id).neq('role', 'admin')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'deactivate_user', resourceType: 'user', resourceId: id, description: `Ulizima akaunti ya mtumiaji #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Akaunti imezimwa' })
  }

  // ── APPROVE VERIFICATION ───────────────────────────────────────────────────
  if (type === 'approve_verification') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_verifications')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kuthibitisha madalali' }, { status: 403 })
    }
    const { error } = await admin
      .from('dalali_profiles')
      .update({ is_premium_verified: true })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: dalaliProf } = await admin.from('dalali_profiles').select('id').eq('id', id).single()
    if (dalaliProf) {
      await admin.from('notifications').insert({
        user_id: id,
        title: '✅ Umethitibikwa!',
        body: 'Akaunti yako imethitibikiwa. Badge ya "Amethibitishwa" inaonekana kwenye profile yako.',
        type: 'verification_approved', is_read: false,
      })
    }
    await logStaffActivity({ staffId: user.id, actionType: 'approve_verification', resourceType: 'dalali', resourceId: id, description: `Ulithibitisha dalali #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Uthibitisho umeidhinishwa' })
  }

  // ── REJECT VERIFICATION ────────────────────────────────────────────────────
  if (type === 'reject_verification') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_verifications')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kuthibitisha madalali' }, { status: 403 })
    }
    const { error } = await admin
      .from('dalali_profiles')
      .update({ nida_number: null, business_license_url: null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await admin.from('notifications').insert({
      user_id: id,
      title: '❌ Uthibitisho Ulikataliwa',
      body: `Maombi yako ya uthibitisho yalikataliwa.${reason ? ` Sababu: ${reason}` : ' Wasiliana na msaada kwa maelezo zaidi.'}`,
      type: 'verification_rejected', is_read: false,
    })
    await logStaffActivity({ staffId: user.id, actionType: 'reject_verification', resourceType: 'dalali', resourceId: id, description: `Ulikataa uthibitisho wa dalali #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Uthibitisho umekataliwa' })
  }

  // ── EXTEND SUBSCRIPTION ────────────────────────────────────────────────────
  if (type === 'extend_subscription') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_subscriptions')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kusimamia usajili' }, { status: 403 })
    }
    const extendDays = days ?? 30
    const { data: sub } = await admin.from('subscriptions').select('expires_at').eq('id', id).single()
    if (!sub) return NextResponse.json({ error: 'Usajili haupatikani' }, { status: 404 })

    const baseDate = new Date(sub.expires_at)
    if (baseDate < new Date()) baseDate.setTime(Date.now())
    const newExpiry = new Date(baseDate.getTime() + extendDays * 86_400_000).toISOString()

    const { error } = await admin.from('subscriptions')
      .update({ expires_at: newExpiry, status: 'active' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'extend_subscription', resourceType: 'subscription', resourceId: id, description: `Uliongeza usajili #${id.slice(0, 8)} kwa siku ${extendDays}` })
    return NextResponse.json({ ok: true, message: `Usajili umeongezwa kwa siku ${extendDays}` })
  }

  // ── SUSPEND SUBSCRIPTION ───────────────────────────────────────────────────
  if (type === 'suspend_subscription') {
    if (!isAdmin && !await hasPermission(user.id, 'manage_subscriptions')) {
      return NextResponse.json({ error: 'Huna ruhusa ya kusimamia usajili' }, { status: 403 })
    }
    const { error } = await admin.from('subscriptions').update({ status: 'expired' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logStaffActivity({ staffId: user.id, actionType: 'suspend_subscription', resourceType: 'subscription', resourceId: id, description: `Ulizima usajili #${id.slice(0, 8)}` })
    return NextResponse.json({ ok: true, message: 'Usajili umesimamishwa' })
  }

  return NextResponse.json({ error: 'Aina ya action haijulikani' }, { status: 400 })
}
