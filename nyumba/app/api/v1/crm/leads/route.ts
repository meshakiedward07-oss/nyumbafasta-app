import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getLeads } from '@/lib/crm/dalaliCRM'

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

// GET /api/v1/crm/leads
export async function GET(req: NextRequest) {
  const ctx = await getStaffContext()
  if (!ctx) return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const stage           = searchParams.get('stage')    || 'all'
  const search          = searchParams.get('search')   || ''
  const page            = parseInt(searchParams.get('page')  || '0')
  const includeArchived = searchParams.get('archived') === '1'

  const result = await getLeads({
    staffId:         ctx.isAdmin ? undefined : ctx.userId,
    isAdmin:         ctx.isAdmin,
    stage:           stage === 'all' ? undefined : stage,
    search:          search || undefined,
    page,
    includeArchived,
  })

  return NextResponse.json(result)
}

// POST /api/v1/crm/leads — create manual lead (admin only)
export async function POST(req: NextRequest) {
  const ctx = await getStaffContext()
  if (!ctx?.isAdmin) return NextResponse.json({ error: 'Admin pekee anaweza kuongeza leads' }, { status: 403 })

  const body = await req.json() as {
    business_name: string
    phone?:        string
    whatsapp?:     string
    region?:       string
    notes?:        string
  }

  if (!body.business_name) {
    return NextResponse.json({ error: 'Jina linahitajika' }, { status: 400 })
  }

  // Deduplicate by phone
  if (body.phone) {
    const db = createAdminClient()
    const { data: existing } = await db
      .from('agent_leads')
      .select('id')
      .eq('phone', body.phone)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Lead na nambari hii tayari ipo' }, { status: 409 })
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('agent_leads')
    .insert({
      business_name:  body.business_name,
      phone:          body.phone   || null,
      whatsapp:       body.whatsapp || body.phone || null,
      region:         body.region   || null,
      notes:          body.notes    || null,
      source:         'manual',
      pipeline_stage: 'mpya',
      status:         'new',
      contact_attempts: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, lead: data })
}
