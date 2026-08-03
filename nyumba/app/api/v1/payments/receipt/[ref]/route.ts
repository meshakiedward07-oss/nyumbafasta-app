import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/payments/receipt/:ref
// Returns a rich receipt object for any payment ref owned by the authenticated user.
// 404 when ref is not found or not owned by the caller.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.com'

type ReceiptType =
  | 'unlock'
  | 'subscription'
  | 'renewal'
  | 'boost'
  | 'extra_listing'
  | 'org_subscription'

interface ReceiptData {
  receipt_number: string
  type:           ReceiptType
  status:         string
  amount_tzs:     number
  paid_at:        string | null
  description:    string
  paid_by:        string | null
  platform:       'NyumbaFasta'
  print_url:      string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  try {
    const { ref } = await params

    if (!ref) {
      return NextResponse.json({ error: 'Risiti haikupatikana' }, { status: 404 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Risiti haikupatikana' }, { status: 404 })
    }

    // Fetch full_name for the paid_by field
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const paidBy: string | null = (profile?.full_name as string | null) ?? null

    const admin = createAdminClient()
    let receipt: ReceiptData | null = null

    // ── NYU-* → contact_unlocks ──────────────────────────────────────────────
    if (ref.startsWith('NYU-')) {
      const { data } = await admin
        .from('contact_unlocks')
        .select('payment_ref, status, amount_paid, created_at, client_id')
        .eq('payment_ref', ref)
        .eq('client_id', user.id)
        .maybeSingle()

      if (data) {
        receipt = {
          receipt_number: ref,
          type:           'unlock',
          status:         data.status,
          amount_tzs:     data.amount_paid ?? 0,
          paid_at:        data.status === 'completed' ? data.created_at : null,
          description:    'Ufunguzi wa mawasiliano ya dalali',
          paid_by:        paidBy,
          platform:       'NyumbaFasta',
          print_url:      `${APP_URL}/payments/receipt/${ref}`,
        }
      }
    }

    // ── SUB-* → subscriptions ────────────────────────────────────────────────
    else if (ref.startsWith('SUB-')) {
      const { data } = await admin
        .from('subscriptions')
        .select('payment_ref, status, amount_paid, plan, starts_at, dalali_id')
        .eq('payment_ref', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (data) {
        receipt = {
          receipt_number: ref,
          type:           'subscription',
          status:         data.status,
          amount_tzs:     data.amount_paid ?? 0,
          paid_at:        data.status === 'active' ? data.starts_at : null,
          description:    `Usajili wa NyumbaFasta — mpango ${data.plan}`,
          paid_by:        paidBy,
          platform:       'NyumbaFasta',
          print_url:      `${APP_URL}/payments/receipt/${ref}`,
        }
      }
    }

    // ── REN-* → subscriptions (renewals share the same table) ────────────────
    else if (ref.startsWith('REN-')) {
      const { data } = await admin
        .from('subscriptions')
        .select('payment_ref, status, amount_paid, plan, starts_at, dalali_id')
        .eq('payment_ref', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (data) {
        receipt = {
          receipt_number: ref,
          type:           'renewal',
          status:         data.status,
          amount_tzs:     data.amount_paid ?? 0,
          paid_at:        data.status === 'active' ? data.starts_at : null,
          description:    `Upyaisho wa usajili — mpango ${data.plan}`,
          paid_by:        paidBy,
          platform:       'NyumbaFasta',
          print_url:      `${APP_URL}/payments/receipt/${ref}`,
        }
      }
    }

    // ── BST-* → boost_payments ───────────────────────────────────────────────
    else if (ref.startsWith('BST-')) {
      const { data } = await admin
        .from('boost_payments')
        .select('payment_ref, status, amount, weeks, boosted_from, dalali_id')
        .eq('payment_ref', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (data) {
        receipt = {
          receipt_number: ref,
          type:           'boost',
          status:         data.status,
          amount_tzs:     data.amount ?? 0,
          paid_at:        data.status === 'completed' ? data.boosted_from : null,
          description:    `Boost ya listing — wiki ${data.weeks}`,
          paid_by:        paidBy,
          platform:       'NyumbaFasta',
          print_url:      `${APP_URL}/payments/receipt/${ref}`,
        }
      }
    }

    // ── EX-* / UPG-* → payments (generic) ───────────────────────────────────
    else if (ref.startsWith('EX-') || ref.startsWith('UPG-')) {
      const { data } = await admin
        .from('payments')
        .select('external_id, status, amount, type, created_at, dalali_id')
        .eq('external_id', ref)
        .eq('dalali_id', user.id)
        .maybeSingle()

      if (data) {
        const receiptType: ReceiptType = data.type === 'upgrade' ? 'subscription' : 'extra_listing'
        receipt = {
          receipt_number: ref,
          type:           receiptType,
          status:         data.status,
          amount_tzs:     data.amount ?? 0,
          paid_at:        data.status === 'completed' ? data.created_at : null,
          description:    'Nafasi za ziada za listings',
          paid_by:        paidBy,
          platform:       'NyumbaFasta',
          print_url:      `${APP_URL}/payments/receipt/${ref}`,
        }
      }
    }

    // ── ORGSUB* → subscription_invoices ─────────────────────────────────────
    else if (ref.startsWith('ORGSUB')) {
      const { data: invoice } = await admin
        .from('subscription_invoices')
        .select('payment_reference, status, amount_tzs, org_id, created_at')
        .eq('payment_reference', ref)
        .maybeSingle()

      if (invoice) {
        // Verify org membership
        const { data: membership } = await admin
          .from('organization_members')
          .select('id')
          .eq('organization_id', invoice.org_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (membership) {
          receipt = {
            receipt_number: ref,
            type:           'org_subscription',
            status:         invoice.status,
            amount_tzs:     invoice.amount_tzs ?? 0,
            paid_at:        invoice.status === 'confirmed' ? invoice.created_at : null,
            description:    'Usajili wa shirika',
            paid_by:        paidBy,
            platform:       'NyumbaFasta',
            print_url:      `${APP_URL}/payments/receipt/${ref}`,
          }
        }
      }
    }

    if (!receipt) {
      return NextResponse.json({ error: 'Risiti haikupatikana' }, { status: 404 })
    }

    return NextResponse.json(receipt)

  } catch (err) {
    console.error('[GET /payments/receipt/[ref]]', err)
    return NextResponse.json({ error: 'Risiti haikupatikana' }, { status: 404 })
  }
}
