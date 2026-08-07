import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; entry_id: string }> }

// PATCH /api/v1/organizations/:id/income/:entry_id
// Org approves or rejects a pending income entry.
// Body: { action: 'approve' | 'reject', rejection_reason?: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, entry_id } = await params
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
      .in('role', ['owner', 'branch_manager', 'accountant'])

    if (!memberCount && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa ya kuidhibiti rekodi hii' }, { status: 403 })
    }

    const { data: entry } = await admin
      .from('org_income_entries')
      .select('id, org_id, status')
      .eq('id', entry_id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (!entry) return NextResponse.json({ error: 'Rekodi haikupatikana' }, { status: 404 })

    const body = await req.json() as { action: string; rejection_reason?: string; amount_tzs?: number; payment_date?: string }
    const { action, rejection_reason, amount_tzs, payment_date } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action lazima iwe approve au reject' }, { status: 400 })
    }
    if (action === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json({ error: 'Sababu ya kukataa inahitajika' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status:      action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at:  now,
    }
    if (action === 'reject') updates.rejection_reason = rejection_reason!.trim()
    // Allow org to correct the amount/date before approving
    if (action === 'approve') {
      if (amount_tzs && Number(amount_tzs) > 0) updates.amount_tzs = Number(amount_tzs)
      if (payment_date)                          updates.payment_date = payment_date
    }

    const { data: updated, error } = await admin
      .from('org_income_entries')
      .update(updates)
      .eq('id', entry_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ entry: updated })
  } catch (err) {
    console.error('[PATCH /organizations/:id/income/:entry_id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
