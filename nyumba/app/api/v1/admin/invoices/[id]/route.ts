import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyOrgInvoiceConfirmed, notifyOrgInvoiceVoided } from '@/lib/subscription/notifications'

type Params = { params: Promise<{ id: string }> }

function periodEnd(billing_cycle: string): string {
  const d = new Date()
  if (billing_cycle === 'monthly')   d.setMonth(d.getMonth() + 1)
  if (billing_cycle === 'quarterly') d.setMonth(d.getMonth() + 3)
  if (billing_cycle === 'annual')    d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

// PATCH /api/v1/admin/invoices/[id]
// Body: { action: 'confirm' | 'void', void_reason? }
// confirm → activates the org's subscription for the invoice's plan + billing_cycle
// void    → cancels the invoice
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body   = await req.json()
    const { action, void_reason } = body

    if (!['confirm', 'void'].includes(action)) {
      return NextResponse.json({ error: 'action lazima iwe "confirm" au "void"' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: invoice } = await admin
      .from('subscription_invoices')
      .select('id, org_id, plan_id, billing_cycle, status')
      .eq('id', id)
      .maybeSingle()

    if (!invoice) return NextResponse.json({ error: 'Ankara haikupatikana' }, { status: 404 })

    if (invoice.status === 'confirmed' || invoice.status === 'void') {
      return NextResponse.json({ error: 'Ankara hii tayari imeshughulikiwa' }, { status: 409 })
    }

    const now = new Date().toISOString()

    if (action === 'void') {
      const { data, error } = await admin
        .from('subscription_invoices')
        .update({
          status:     'void',
          voided_by:  auth.userId,
          voided_at:  now,
          void_reason: void_reason?.trim() || 'Admin action',
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      notifyOrgInvoiceVoided(invoice.org_id, void_reason?.trim() || 'Admin action').catch(() => {})
      return NextResponse.json({ invoice: data })
    }

    // action === 'confirm'
    // 1. Update invoice
    const { data: updatedInvoice, error: invErr } = await admin
      .from('subscription_invoices')
      .update({
        status:       'confirmed',
        confirmed_by: auth.userId,
        confirmed_at: now,
        updated_at:   now,
      })
      .eq('id', id)
      .select()
      .single()

    if (invErr) throw invErr

    // 2. Activate / upgrade the organization's subscription
    const end = periodEnd(invoice.billing_cycle)
    const { error: subErr } = await admin
      .from('organization_subscriptions')
      .update({
        plan_id:              invoice.plan_id,
        status:               'active',
        current_period_start: now,
        current_period_end:   end,
        pending_plan_id:      null,
        pending_plan_starts_at: null,
        cancelled_at:         null,
        cancellation_reason:  null,
        updated_at:           now,
      })
      .eq('org_id', invoice.org_id)

    if (subErr) throw subErr

    // Fetch plan name for the notification
    const { data: planRow } = await admin
      .from('subscription_plans')
      .select('name')
      .eq('id', invoice.plan_id)
      .maybeSingle()
    notifyOrgInvoiceConfirmed(invoice.org_id, planRow?.name ?? 'Mpango').catch(() => {})

    return NextResponse.json({ invoice: updatedInvoice, message: 'Ankara imethibitishwa. Usajili umesasishwa.' })
  } catch (err) {
    console.error('[PATCH /admin/invoices/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
