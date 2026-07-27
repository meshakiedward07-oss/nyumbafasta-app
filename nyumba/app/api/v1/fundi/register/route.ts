import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/v1/fundi/register
// Called after email verification to create users row + fundi_profiles row
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const body  = await req.json()
    const { full_name, phone } = body

    const { error: userErr } = await admin.from('users').upsert(
      {
        id:             user.id,
        full_name:      (full_name?.trim() || user.email) as string,
        phone:          phone?.trim() || null,
        role:           'fundi',
        account_status: 'active',
      },
      { onConflict: 'id' }
    )
    if (userErr) throw userErr

    const { data: existing } = await admin.from('fundi_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!existing) {
      await admin.from('fundi_profiles').insert({ user_id: user.id })
    }

    const { data: profile } = await admin.from('fundi_profiles').select('*').eq('user_id', user.id).single()
    return NextResponse.json({ ok: true, profile })
  } catch (err) {
    console.error('[POST /fundi/register]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
