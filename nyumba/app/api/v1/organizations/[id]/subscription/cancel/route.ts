import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'

type Params = { params: Promise<{ id: string }> }

// POST /api/v1/organizations/[id]/subscription/cancel
// Body: { reason? }
// - trial: cancelled immediately
// - active: sets cancelled_at = now; cron transitions to cancelled at period end
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: userRow }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role, phone').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(userRow?.role ?? '')
    const isOwner = membership?.role === 'owner'
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kughairi usajili' }, { status: 403 })
    }

    const { data: sub } = await admin
      .from('organization_subscriptions')
      .select('status, current_period_end, cancelled_at, plan:subscription_plans(name)')
      .eq('org_id', id)
      .maybeSingle()

    if (!sub) return NextResponse.json({ error: 'Usajili haukupatikana' }, { status: 404 })
    if (!['trial', 'active', 'past_due', 'grace_period'].includes(sub.status)) {
      return NextResponse.json({ error: 'Usajili huu hauwezi kughairiwa' }, { status: 409 })
    }
    if (sub.cancelled_at) {
      return NextResponse.json({ error: 'Usajili tayari umewekwa kughairiwa' }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const reason: string = body.reason?.trim() || 'Ombi la mtumiaji'
    const now = new Date().toISOString()

    const immediateCancel = sub.status === 'trial'

    const { data: updated, error } = await admin
      .from('organization_subscriptions')
      .update({
        status:               immediateCancel ? 'cancelled' : sub.status,
        cancelled_at:         now,
        cancellation_reason:  reason,
        updated_at:           now,
      })
      .eq('org_id', id)
      .select()
      .single()

    if (error) throw error

    const planName = (sub.plan as unknown as { name: string } | null)?.name ?? 'Mpango'
    const periodEnd = sub.current_period_end
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
    const waMsg = immediateCancel
      ? `*NyumbaFasta — Usajili Umeghairiwa* ❌\n\nUsajili wako wa ${planName} umeghairiwa leo.\n\nUnaweza kujiunga tena wakati wowote:\n${appUrl}/property/usajili`
      : `*NyumbaFasta — Ughairi Umepangwa* 🔔\n\nOmbi lako la kughairi usajili wa ${planName} limepokelewa.\n\nUtaendelea kupata huduma kamili hadi ${periodEnd ? new Date(periodEnd).toLocaleDateString('sw-TZ') : 'mwisho wa mzunguko'}.\n\n${appUrl}/property/usajili`

    if (userRow?.phone) {
      sendTextMessage(formatPhoneNumber(userRow.phone), waMsg).catch(() => {})
    }

    const message = immediateCancel
      ? 'Usajili umeghairiwa.'
      : 'Ughairi umepangwa. Utaendelea kupata huduma kamili hadi mwisho wa mzunguko wa sasa.'

    return NextResponse.json({ subscription: updated, message })
  } catch (err) {
    console.error('[POST /organizations/[id]/subscription/cancel]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
