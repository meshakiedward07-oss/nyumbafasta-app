import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Verifies the current request has an authenticated admin session.
 * Returns { ok: true } or a ready-to-return 401/403 NextResponse.
 */
export async function requireAdminAuth(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 }),
    }
  }

  return { ok: true }
}
