import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AuthResult = { ok: true; role: string } | { ok: false; response: NextResponse }

/**
 * Verifies the current request has an authenticated admin session.
 * Returns { ok: true, role } or a ready-to-return 401/403 NextResponse.
 */
export async function requireAdminAuth(): Promise<AuthResult> {
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

  return { ok: true, role: 'admin' }
}

/**
 * Allows admin OR staff roles (for internal team routes).
 * Staff can only see their own assigned leads (enforced by RLS).
 */
export async function requireStaffAuth(): Promise<AuthResult> {
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
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Ruhusa ya staff inahitajika' }, { status: 403 }),
    }
  }

  if (profile?.role === 'staff' && profile?.staff_active === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 }),
    }
  }

  return { ok: true, role: profile?.role ?? 'staff' }
}
