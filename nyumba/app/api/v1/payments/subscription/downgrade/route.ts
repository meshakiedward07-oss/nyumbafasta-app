import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PLAN_ORDER: Record<string, number> = { free: 0, basic: 1, premium: 2, enterprise: 3 }

// POST /api/v1/payments/subscription/downgrade
// Body: { to_plan: 'free'|'basic'|'premium' }
//
// Schedules a plan downgrade to take effect at the end of the current period.
// The daily cron applies it once expires_at has passed.
// Only downgrades (lower plan) are allowed; use /upgrade for upgrades.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { to_plan } = await req.json()
    if (!to_plan || !['free', 'basic', 'premium'].includes(to_plan)) {
      return NextResponse.json({ error: 'to_plan lazima iwe free, basic, au premium' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: currentSub, error: subErr } = await admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, pending_plan')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subErr) {
      console.error('[Sub/downgrade] subscription fetch error:', subErr)
      return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
    }
    if (!currentSub) {
      return NextResponse.json({ error: 'Hakuna usajili wa kubadilisha' }, { status: 404 })
    }
    if (currentSub.plan === to_plan) {
      return NextResponse.json({ error: `Uko tayari kwenye mpango wa ${to_plan}` }, { status: 400 })
    }
    if ((PLAN_ORDER[to_plan] ?? 0) >= (PLAN_ORDER[currentSub.plan] ?? 0)) {
      return NextResponse.json({ error: 'Hii ni kupanda mpango — tumia /upgrade badala yake' }, { status: 400 })
    }

    // Schedule the downgrade at period end
    const { error: updateErr } = await admin
      .from('subscriptions')
      .update({
        pending_plan:    to_plan,
        pending_plan_at: new Date().toISOString(),
      })
      .eq('id', currentSub.id)

    if (updateErr) {
      console.error('[Sub/downgrade] update error:', updateErr)
      return NextResponse.json({ error: 'Imeshindwa kusajili mabadiliko' }, { status: 500 })
    }

    // In-app notification
    await admin.from('notifications').insert({
      user_id: user.id,
      type:    'subscription_downgrade_scheduled',
      title:   '🔽 Mpango wa Kushuka Umesajiliwa',
      body:    `Mpango wako utashuka hadi ${to_plan} baada ya tarehe ${currentSub.expires_at ? new Date(currentSub.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Unaweza kubatilisha ombi hili wakati wowote.`,
      is_read: false,
    })

    const expiresLabel = currentSub.expires_at
      ? new Date(currentSub.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—'

    return NextResponse.json({
      scheduled:    true,
      to_plan,
      from_plan:    currentSub.plan,
      effective_at: currentSub.expires_at,
      message:      `Mpango utashuka hadi ${to_plan} tarehe ${expiresLabel}`,
    })
  } catch (err) {
    console.error('[Sub/downgrade] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
