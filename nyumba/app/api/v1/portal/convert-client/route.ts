import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('users')
      .select('role, portal_type')
      .eq('id', user.id)
      .maybeSingle()

    // Already a tenant — idempotent
    if ((profile as Record<string, string> | null)?.portal_type === 'tenant') {
      return NextResponse.json({ portal_type: 'tenant' })
    }

    // Must be a regular marketplace client to convert
    if (profile?.role !== 'client') {
      return NextResponse.json(
        { error: 'Akaunti hii haiwezi kubadilishwa hadi mpangaji.' },
        { status: 400 }
      )
    }

    const body  = await req.json().catch(() => ({}))
    const phone = (body.phone as string | undefined)?.trim() || null

    // Update users DB row
    await admin.from('users').update({
      portal_type: 'tenant',
      ...(phone ? { phone } : {}),
    }).eq('id', user.id)

    // Update Supabase Auth metadata so login redirect works
    const { data: authUser } = await admin.auth.admin.getUserById(user.id)
    const existingMeta = authUser?.user?.user_metadata ?? {}
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...existingMeta,
        portal_type: 'tenant',
        ...(phone ? { phone } : {}),
      },
    })

    return NextResponse.json({ portal_type: 'tenant' })
  } catch (err) {
    console.error('convert-client error:', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
