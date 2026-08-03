import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/payments/status?ref=<payment_ref>
// Returns { found, status, amount, created_at, type, ...relevant fields }
// Always 200 — sets found:false when ref is not found or not owned by the caller.
// Auth: must be authenticated; ownership is always verified against client_id/dalali_id.

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('ref')?.trim()
    if (!ref) {
      return NextResponse.json({ found: false, error: 'ref inahitajika' })
    }

    // Authenticate caller — we need a user to verify ownership
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ found: false })
    }

    const admin = createAdminClient()

    // ── NYU-* → contact_unlocks ────────────────────────────────────────────────
    if (ref.startsWith('NYU-')) {
      const { data } = await admin
        .from('contact_unlocks')
        .select('payment_ref, status, amount_paid, created_at, client_id, listing_id')
        .eq('payment_ref', ref)
        .eq('client_id', user.id)
        .maybeSingle()

      if (!data) return NextResponse.json({ found: false })

      return NextResponse.json({
        found:       true,
        type:        'unlock',
        status:      data.status,
        amount:      data.amount_paid,
        created_at:  data.created_at,
        listing_id:  data.listing_id,
        payment_ref: data.payment_ref,
      })
    }

    // ── SUB-* / REN-* → subscriptions ─────────────────────────────────────────
    if (ref.startsWith('SUB-') || ref.startsWith('REN-')) {
      const { data } = await admin
        .from('subscriptions')
        .select('payment_ref, status, amount_paid, plan, starts_at, expires_at, created_at, dalali_id')
        .eq('payment_ref', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (!data) return NextResponse.json({ found: false })

      return NextResponse.json({
        found:       true,
        type:        ref.startsWith('SUB-') ? 'subscription' : 'renewal',
        status:      data.status,
        amount:      data.amount_paid,
        plan:        data.plan,
        starts_at:   data.starts_at,
        expires_at:  data.expires_at,
        created_at:  data.created_at,
        payment_ref: data.payment_ref,
      })
    }

    // ── BST-* → boost_payments ─────────────────────────────────────────────────
    if (ref.startsWith('BST-')) {
      const { data } = await admin
        .from('boost_payments')
        .select('payment_ref, status, amount, weeks, boosted_until, created_at, dalali_id')
        .eq('payment_ref', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (!data) return NextResponse.json({ found: false })

      return NextResponse.json({
        found:         true,
        type:          'boost',
        status:        data.status,
        amount:        data.amount,
        weeks:         data.weeks,
        boosted_until: data.boosted_until,
        created_at:    data.created_at,
        payment_ref:   data.payment_ref,
      })
    }

    // ── EX-* / UPG-* → payments (generic) — external_id column ───────────────
    if (ref.startsWith('EX-') || ref.startsWith('UPG-')) {
      const { data } = await admin
        .from('payments')
        .select('external_id, status, amount, type, created_at, dalali_id')
        .eq('external_id', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (!data) return NextResponse.json({ found: false })

      return NextResponse.json({
        found:       true,
        type:        data.type ?? 'extra_listing',
        status:      data.status,
        amount:      data.amount,
        created_at:  data.created_at,
        payment_ref: data.external_id,
      })
    }

    // ── ORGSUB* → subscription_invoices ───────────────────────────────────────
    if (ref.startsWith('ORGSUB')) {
      const { data: invoice } = await admin
        .from('subscription_invoices')
        .select('payment_reference, status, amount_tzs, org_id, created_at')
        .eq('payment_reference', ref)
        .maybeSingle()

      if (!invoice) return NextResponse.json({ found: false })

      // Verify caller is a member of the org
      const { data: membership } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', invoice.org_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) return NextResponse.json({ found: false })

      return NextResponse.json({
        found:       true,
        type:        'org_subscription',
        status:      invoice.status,
        amount:      invoice.amount_tzs,
        org_id:      invoice.org_id,
        created_at:  invoice.created_at,
        payment_ref: invoice.payment_reference,
      })
    }

    // Unrecognised prefix
    return NextResponse.json({ found: false })

  } catch (err) {
    console.error('[GET /payments/status]', err)
    return NextResponse.json({ found: false })
  }
}
