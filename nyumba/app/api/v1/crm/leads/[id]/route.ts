import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getStaffContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) return null
  if (profile?.role === 'staff' && profile?.staff_active === false) return null

  return { userId: user.id, role: profile?.role as string, isAdmin: profile?.role === 'admin' }
}

// GET /api/v1/crm/leads/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getStaffContext()
  if (!ctx) return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })

  const { id } = await params
  const db = createAdminClient()

  let query = db
    .from('agent_leads')
    .select(`
      id, business_name, phone, whatsapp, region, source,
      pipeline_stage, assigned_to, assigned_at,
      last_contacted_at, contact_attempts, next_followup_at,
      notes, converted_to_profile_id, converted_at,
      first_listing_id, first_listing_at, status,
      created_at, updated_at,
      assigned_staff:users!assigned_to ( id, full_name, phone ),
      converted_profile:users!converted_to_profile_id ( id, full_name )
    `)
    .eq('id', id)

  if (!ctx.isAdmin) {
    query = query.eq('assigned_to', ctx.userId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json({ error: 'Lead haikupatikana' }, { status: 404 })
  }

  return NextResponse.json({ lead: data })
}

// PATCH /api/v1/crm/leads/[id] — update notes/details
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getStaffContext()
  if (!ctx) return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    notes?:          string
    whatsapp?:       string
    next_followup_at?: string
  }

  const db = createAdminClient()
  const { error } = await db
    .from('agent_leads')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
