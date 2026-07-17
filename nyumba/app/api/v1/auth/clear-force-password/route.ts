import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Called after staff successfully changes their forced-first-login password.
// Uses the admin client so RLS doesn't block the must_change_password → false update.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Hakuna session' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the user's role so the client can redirect correctly
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ ok: true, role: profile?.role ?? 'client' })
}
