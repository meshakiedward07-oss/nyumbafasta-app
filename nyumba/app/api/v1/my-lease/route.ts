import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/my-lease
// Returns the current user's active lease(s) as a tenant, with payments + banking info.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // All leases where this user is the tenant
    const { data: leases } = await admin
      .from('leases')
      .select(`
        id, org_id, tenant_id, monthly_rent, deposit_amount, deposit_paid,
        start_date, end_date, status, payment_day, notes,
        unit:property_units(id, unit_number, unit_type),
        listing:listings(id, title, district, region, images)
      `)
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })

    if (!leases || leases.length === 0) {
      return NextResponse.json({ leases: [] })
    }

    // For each lease, fetch payments + banking + org name
    const enriched = await Promise.all(leases.map(async lease => {
      const orgId = lease.org_id as string

      const [paymentsRes, bankingRes, orgRes] = await Promise.all([
        admin.from('lease_payments')
          .select('id, status, amount_due, amount_paid, due_date, paid_date, proof_url, proof_note, proof_uploaded_at, verified_at, invoice_sent_at')
          .eq('lease_id', lease.id)
          .order('due_date', { ascending: false })
          .limit(12),
        admin.from('organization_banking')
          .select('bank_name, account_name, account_number, branch, mobile_money_number, mobile_money_provider, additional_instructions')
          .eq('org_id', orgId)
          .maybeSingle(),
        admin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      ])

      return {
        lease,
        payments:  paymentsRes.data  ?? [],
        banking:   bankingRes.data   ?? null,
        org_name:  orgRes.data?.name ?? null,
        org_id:    orgId,
      }
    }))

    return NextResponse.json({ leases: enriched })
  } catch (err) {
    console.error('[GET /my-lease]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
