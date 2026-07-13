import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type FixAction =
  | 'activate_subscription'
  | 'extend_subscription'
  | 'complete_unlock'
  | 'fail_payment'

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const admin  = createAdminClient()
  const userId = params.userId

  const body = await req.json()
  const { action, record_type, record_id } = body as {
    action: FixAction
    record_type: 'subscription' | 'contact_unlock' | 'boost_payment'
    record_id: string
  }

  if (!action || !record_type || !record_id) {
    return NextResponse.json({ error: 'action, record_type, na record_id vinahitajika' }, { status: 400 })
  }

  try {
    let message = ''

    // ── Activate / reactivate a pending or expired subscription ──────────────
    if (action === 'activate_subscription') {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, status, expires_at')
        .eq('id', record_id)
        .eq('dalali_id', userId)
        .single()
      if (!sub) return NextResponse.json({ error: 'Subscription haipatikani' }, { status: 404 })

      const now     = new Date()
      let expiresAt = sub.expires_at ? new Date(sub.expires_at) : null
      // If already expired or null, give 30 days from today
      if (!expiresAt || expiresAt < now) {
        expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + 30)
      }

      await admin
        .from('subscriptions')
        .update({ status: 'active', expires_at: expiresAt.toISOString() })
        .eq('id', record_id)

      await admin.from('notifications').insert({
        user_id: userId,
        title:   '✅ Subscription Imewashwa!',
        body:    'Subscription yako imewashwa na admin. Listings zako zinaonekana kwa wateja.',
        type:    'subscription_active',
        is_read: false,
      })

      message = 'Subscription imewashwa'
    }

    // ── Extend an active subscription by 30 days ─────────────────────────────
    else if (action === 'extend_subscription') {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, expires_at')
        .eq('id', record_id)
        .eq('dalali_id', userId)
        .single()
      if (!sub) return NextResponse.json({ error: 'Subscription haipatikani' }, { status: 404 })

      const base = sub.expires_at && new Date(sub.expires_at) > new Date()
        ? new Date(sub.expires_at)
        : new Date()
      base.setDate(base.getDate() + 30)

      await admin
        .from('subscriptions')
        .update({ status: 'active', expires_at: base.toISOString() })
        .eq('id', record_id)

      await admin.from('notifications').insert({
        user_id: userId,
        title:   '📅 Subscription Imepanuliwa!',
        body:    `Subscription yako imepanuliwa hadi ${base.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} na admin.`,
        type:    'subscription_active',
        is_read: false,
      })

      message = 'Subscription imepanuliwa kwa siku 30'
    }

    // ── Force-complete a pending contact unlock ───────────────────────────────
    else if (action === 'complete_unlock') {
      const { data: unlock } = await admin
        .from('contact_unlocks')
        .select('id, client_id, listing_id, dalali_id, status')
        .eq('id', record_id)
        .eq('client_id', userId)
        .single()
      if (!unlock) return NextResponse.json({ error: 'Unlock haipatikani' }, { status: 404 })

      await admin
        .from('contact_unlocks')
        .update({ status: 'completed' })
        .eq('id', record_id)

      await admin.from('notifications').insert({
        user_id: unlock.client_id,
        title:   '🔓 Namba Imefunguliwa!',
        body:    'Malipo yako yamekamilika. Namba ya dalali sasa inapatikana kwenye listing.',
        type:    'unlock_completed',
        is_read: false,
      })

      message = 'Unlock imekamilika — mteja amearifiwa'
    }

    // ── Mark a stale pending record as failed (so user can retry) ─────────────
    else if (action === 'fail_payment') {
      if (record_type === 'subscription') {
        await admin.from('subscriptions').update({ status: 'failed' }).eq('id', record_id).eq('dalali_id', userId)
      } else if (record_type === 'contact_unlock') {
        await admin.from('contact_unlocks').update({ status: 'failed' }).eq('id', record_id).eq('client_id', userId)
      } else if (record_type === 'boost_payment') {
        await admin.from('boost_payments').update({ status: 'failed' }).eq('id', record_id).eq('dalali_id', userId)
      }
      message = 'Malipo yamewekwa kama yameshindwa — mtumiaji anaweza jaribu tena'
    }

    else {
      return NextResponse.json({ error: 'Action haijulikani' }, { status: 400 })
    }

    // Log admin action (non-fatal — table may not exist yet)
    admin.from('admin_logs').insert({
      admin_id:       user.id,
      action,
      target_user_id: userId,
      record_type,
      record_id,
      note:           message,
    }).then(({ error }) => {
      if (error) console.warn('[AdminFix] admin_logs insert failed (non-fatal):', error.message)
    })

    return NextResponse.json({ success: true, message })
  } catch (err) {
    console.error('[AdminFix] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
