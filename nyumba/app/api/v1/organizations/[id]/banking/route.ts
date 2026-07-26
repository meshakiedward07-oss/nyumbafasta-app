import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/banking
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: orgId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ count: membership }, { data: u }] = await Promise.all([
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    if (!membership && !['admin', 'staff'].includes(u?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { data } = await admin.from('organization_banking').select('*').eq('org_id', orgId).maybeSingle()
    return NextResponse.json({ banking: data ?? null })
  } catch (err) {
    console.error('[GET /organizations/[id]/banking]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/[id]/banking  — upsert bank details (owner only)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orgId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: m }, { data: u }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(u?.role ?? '')
    if (!isAdminStaff && m?.role !== 'owner') {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kuweka maelezo ya benki' }, { status: 403 })
    }

    const body = await req.json()
    const { bank_name, account_name, account_number, branch,
            mobile_money_number, mobile_money_provider, additional_instructions } = body

    if (!bank_name?.trim())      return NextResponse.json({ error: 'Jina la benki linahitajika' },   { status: 400 })
    if (!account_name?.trim())   return NextResponse.json({ error: 'Jina la akaunti linahitajika' }, { status: 400 })
    if (!account_number?.trim()) return NextResponse.json({ error: 'Namba ya akaunti linahitajika' }, { status: 400 })

    const now = new Date().toISOString()
    const payload = {
      org_id:                  orgId,
      bank_name:               bank_name.trim(),
      account_name:            account_name.trim(),
      account_number:          account_number.trim(),
      branch:                  branch?.trim() || null,
      mobile_money_number:     mobile_money_number?.trim() || null,
      mobile_money_provider:   mobile_money_provider?.trim() || null,
      additional_instructions: additional_instructions?.trim() || null,
      created_by:              user.id,
      updated_at:              now,
    }

    // Upsert on org_id unique constraint
    const { data, error } = await admin
      .from('organization_banking')
      .upsert(payload, { onConflict: 'org_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ banking: data })
  } catch (err) {
    console.error('[POST /organizations/[id]/banking]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
