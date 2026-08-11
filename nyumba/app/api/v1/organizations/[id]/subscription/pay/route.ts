import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, normalizePhone, detectProvider,
  generateExternalId, webhookUrl, type MobileProvider,
} from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

type Params = { params: Promise<{ id: string }> }

const PROVIDER_MAP: Record<string, MobileProvider> = {
  mpesa: 'Mpesa', airtel: 'Airtel', tigo: 'Tigo', tigopesa: 'Tigo',
  halopesa: 'Halopesa', azampesa: 'Azampesa',
  Mpesa: 'Mpesa', Airtel: 'Airtel', Tigo: 'Tigo',
  Halopesa: 'Halopesa', Azampesa: 'Azampesa',
}

// POST /api/v1/organizations/[id]/subscription/pay
// Body: { plan_id, billing_cycle?, msisdn, provider? }
// Initiates AzamPay mobile checkout for an org subscription upgrade.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orgId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const rl = await rateLimit(`org-sub-pay:${user.id}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 10' }, { status: 429 })
    }

    const admin = createAdminClient()

    // Verify caller is owner of this org (or admin/staff)
    const [{ data: membership }, { data: userRow }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role, phone').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(userRow?.role ?? '')
    const isOwner      = membership?.role === 'owner'
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kubadilisha mpango' }, { status: 403 })
    }

    const body = await req.json()
    const { plan_id, billing_cycle = 'monthly', msisdn, provider } = body

    if (!plan_id)  return NextResponse.json({ error: 'plan_id inahitajika' }, { status: 400 })
    if (!msisdn)   return NextResponse.json({ error: 'Namba ya simu inahitajika (msisdn)' }, { status: 400 })

    const validCycles = ['monthly', 'quarterly', 'annual']
    if (!validCycles.includes(billing_cycle)) {
      return NextResponse.json({ error: 'billing_cycle si sahihi (monthly, quarterly, annual)' }, { status: 400 })
    }

    // Resolve plan
    const { data: plan } = await admin
      .from('subscription_plans')
      .select('id, name, price_tzs, billing_cycle')
      .eq('id', plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!plan) return NextResponse.json({ error: 'Mpango haukupatikana' }, { status: 404 })
    if (plan.price_tzs === 0) return NextResponse.json({ error: 'Mpango huu ni bure — huhitaji malipo' }, { status: 400 })

    // Compute amount
    const multiplier = billing_cycle === 'monthly' ? 1 : billing_cycle === 'quarterly' ? 3 : 12
    const amount_tzs = plan.price_tzs * multiplier

    // Normalize and validate phone
    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const azamProvider = provider ? (PROVIDER_MAP[provider] ?? detectProvider(accountNumber)) : detectProvider(accountNumber)
    const payment_reference = generateExternalId('ORGSUB')

    // Due date: 1 day (USSD payment should complete immediately)
    const due = new Date()
    due.setDate(due.getDate() + 1)

    // Create invoice record first (so we have something to roll back to on AzamPay failure)
    const { data: invoice, error: invErr } = await admin
      .from('subscription_invoices')
      .insert({
        org_id:            orgId,
        plan_id:           plan.id,
        amount_tzs,
        billing_cycle,
        status:            'pending',
        due_date:          due.toISOString().slice(0, 10),
        payment_reference,
        created_by:        user.id,
      })
      .select('id')
      .single()

    if (invErr || !invoice) {
      console.error('[OrgSubPay] Invoice insert failed:', invErr)
      return NextResponse.json({ error: 'Imeshindwa kuanzisha ombi la malipo' }, { status: 500 })
    }

    const result = await mobileCheckout({
      accountNumber,
      amount:      amount_tzs,
      externalId:  payment_reference,
      provider:    azamProvider,
      description: `NyumbaFasta — ${plan.name} (${billing_cycle})`,
      callbackUrl: webhookUrl('/api/v1/payments/org-subscription/webhook'),
    })

    if (!result.ok) {
      // Roll back the invoice so the user can retry cleanly
      await admin.from('subscription_invoices').delete().eq('id', invoice.id)
      console.error('[OrgSubPay] mobileCheckout failed:', result.message)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    console.log('[OrgSubPay] Checkout initiated. invoice:', invoice.id, 'ref:', payment_reference)

    return NextResponse.json({
      invoice_id:        invoice.id,
      payment_reference,
      amount_tzs,
      message:           result.message || 'Subiri USSD popup kwenye simu yako uiidhinishe malipo.',
    })
  } catch (err) {
    console.error('[OrgSubPay] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
