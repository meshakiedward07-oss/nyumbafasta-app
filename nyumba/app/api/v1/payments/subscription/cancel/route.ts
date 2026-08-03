import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/v1/payments/subscription/cancel
// Cancels the dalali's active (or grace-period) subscription.
// If subscription still has future access, status stays 'active' and
// cancelled_at is stamped; the daily cron transitions to 'expired' at expires_at.
// If already in grace_period / past expires_at, we set status='cancelled' immediately.

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch the most recent cancellable subscription
    const { data: sub, error: fetchError } = await admin
      .from('subscriptions')
      .select('id, status, expires_at, dalali_id')
      .eq('dalali_id', user.id)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('[Sub/cancel] fetch error:', fetchError)
      return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
    }

    if (!sub) {
      return NextResponse.json({ error: 'Hakuna usajili wa kubatilisha' }, { status: 404 })
    }

    const now       = new Date()
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null
    const hasFutureAccess = expiresAt && expiresAt > now

    if (hasFutureAccess) {
      // Mark cancelled but keep access until expires_at.
      // Try setting cancelled_at first; fall back to status='cancelled' if column absent.
      const { error: updateError } = await admin
        .from('subscriptions')
        .update({ cancelled_at: now.toISOString() })
        .eq('id', sub.id)

      if (updateError) {
        // cancelled_at column may not exist — fall back to direct cancellation
        console.warn('[Sub/cancel] cancelled_at column missing, setting status=cancelled:', updateError.message)
        await admin
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('id', sub.id)
      }
    } else {
      // Grace period or past expiry — cancel immediately
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('id', sub.id)
    }

    // In-app notification
    const accessUntil = expiresAt ?? now
    const accessUntilFmt = accessUntil.toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    await admin.from('notifications').insert({
      user_id:  user.id,
      title:    '🚫 Usajili Umebatilishwa',
      body:     `Usajili wako umebatilishwa. Utaendelea kupata huduma hadi ${accessUntilFmt}.`,
      type:     'subscription_cancelled',
      is_read:  false,
    })

    return NextResponse.json({
      success:      true,
      access_until: accessUntil.toISOString(),
    })

  } catch (err) {
    console.error('[Sub/cancel] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
