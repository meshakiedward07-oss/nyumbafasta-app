import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

const ALLOWED_ORG_ROLES = ['owner', 'branch_manager', 'agent', 'accountant']

// GET /api/v1/organizations/:id/income
// Returns income entries for this org.
// Query: status (all | pending_review | approved | rejected), limit, offset
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')

    const { count: memberCount } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .in('role', ALLOWED_ORG_ROLES)

    if (!memberCount && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const url    = req.nextUrl
    const status = url.searchParams.get('status') || 'all'
    const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    let query = admin
      .from('org_income_entries')
      .select(`
        id, org_id, submitted_by, submitted_by_role,
        lease_id, amount_tzs, payment_date, payment_method,
        reference_number, description, receipt_url, ai_extracted,
        status, reviewed_by, reviewed_at, rejection_reason,
        created_at,
        submitter:submitted_by(full_name),
        lease:leases!lease_id(
          id, monthly_rent,
          tenant:users!tenant_id(full_name, phone),
          unit:property_units(unit_number)
        )
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ entries: data ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('[GET /organizations/:id/income]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/income
// Creates a manual income entry.
// submitted_by_role='org'    → approved immediately (org trusts itself)
// submitted_by_role='tenant' → status='pending_review' (org must approve)
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')

    // Check if org member or admin/staff
    const { count: memberCount } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .in('role', ALLOWED_ORG_ROLES)

    // Check if the user is a tenant in this org (for tenant-submitted entries)
    const { count: tenantCount } = await admin
      .from('leases')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('tenant_id', user.id)
      .eq('status', 'active')

    if (!memberCount && !isAdminStaff && !tenantCount) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const body = await req.json()
    const {
      amount_tzs,
      payment_date,
      payment_method,
      reference_number,
      description,
      receipt_url,
      ai_extracted,
      lease_id,
    } = body

    if (!amount_tzs || Number(amount_tzs) <= 0) {
      return NextResponse.json({ error: 'Kiasi sahihi kinahitajika' }, { status: 400 })
    }
    if (!payment_date) {
      return NextResponse.json({ error: 'Tarehe ya malipo inahitajika' }, { status: 400 })
    }

    // Determine who is submitting and what status to assign
    const isOrgMember  = !!(memberCount || isAdminStaff)
    const submittedRole = isOrgMember ? 'org' : 'tenant'
    const entryStatus   = isOrgMember ? 'approved' : 'pending_review'

    // If org member, auto-set reviewed fields
    const reviewedFields = isOrgMember ? {
      reviewed_by:  user.id,
      reviewed_at:  new Date().toISOString(),
    } : {}

    // Validate lease_id belongs to this org (if provided)
    if (lease_id) {
      const { data: lease } = await admin
        .from('leases').select('id, org_id').eq('id', lease_id).maybeSingle()
      if (!lease || lease.org_id !== orgId) {
        return NextResponse.json({ error: 'Mkataba haukupatikana katika shirika hili' }, { status: 400 })
      }
    }

    const { data, error } = await admin
      .from('org_income_entries')
      .insert({
        org_id:           orgId,
        submitted_by:     user.id,
        submitted_by_role: submittedRole,
        lease_id:         lease_id || null,
        amount_tzs:       Number(amount_tzs),
        payment_date,
        payment_method:   payment_method || 'cash',
        reference_number: reference_number?.trim() || null,
        description:      description?.trim() || '',
        receipt_url:      receipt_url?.trim() || null,
        ai_extracted:     ai_extracted ?? null,
        status:           entryStatus,
        ...reviewedFields,
      })
      .select()
      .single()

    if (error) throw error

    // Notify org owner when tenant submits (non-fatal)
    if (submittedRole === 'tenant') {
      ;(async () => {
        try {
          const { data: ownerRow } = await admin
            .from('organization_members')
            .select('user:users(id, phone, full_name)')
            .eq('organization_id', orgId)
            .eq('role', 'owner')
            .maybeSingle()

          const owner = ownerRow?.user as unknown as { id: string; phone: string | null } | null
          if (!owner) return

          await admin.from('notifications').insert({
            user_id: owner.id,
            title:   '💰 Malipo Yamewasilishwa',
            body:    `Mpangaji amerekodia malipo ya TZS ${Number(amount_tzs).toLocaleString()} nje ya mfumo. Thibitisha au kataa.`,
            type:    'manual_income_submitted',
            is_read: false,
            data:    JSON.stringify({ income_entry_id: data.id, org_id: orgId }),
          })

          if (owner.phone) {
            const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
            const msg =
              `💰 *NyumbaFasta — Malipo Yamewasilishwa*\n\n` +
              `Mpangaji amerekodia malipo ya kodi ya *TZS ${Number(amount_tzs).toLocaleString()}*.\n\n` +
              `Thibitisha hapa:\n${appUrl}/property/hesabu`
            sendTextMessage(formatPhoneNumber(owner.phone), msg).catch(() => {})
          }
        } catch { /* non-fatal */ }
      })().catch(() => {})
    }

    return NextResponse.json({ entry: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/income]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
