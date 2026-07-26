import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/v1/organizations/[id]/deactivate
// Soft-deactivates an organization — sets deactivated_at + status='suspended'
// Data is never deleted (feature gating, not data deletion)
// Only the org owner or admin can deactivate
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: actorM }, { data: actorU }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])

    const isAdminStaff = ['admin', 'staff'].includes(actorU?.role ?? '')
    const isOwner      = actorM?.role === 'owner'
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kufunga shirika' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const reason: string | null = body.reason?.trim() || null

    const now = new Date().toISOString()
    const { data, error } = await admin
      .from('organizations')
      .update({ status: 'suspended', deactivated_at: now, updated_at: now })
      .eq('id', id)
      .select('id, name, status, deactivated_at')
      .single()

    if (error) throw error

    // Cancel the active subscription (non-fatal)
    await admin
      .from('organization_subscriptions')
      .update({
        status:              'cancelled',
        cancelled_at:        now,
        cancellation_reason: reason ?? 'Org deactivated by owner',
        updated_at:          now,
      })
      .eq('org_id', id)
      .in('status', ['trial', 'active', 'past_due', 'grace_period'])

    return NextResponse.json({ organization: data, message: 'Shirika limefungwa. Data yako iko salama.' })
  } catch (err) {
    console.error('[POST /organizations/[id]/deactivate]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
