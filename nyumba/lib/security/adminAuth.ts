import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type AuthResult = { ok: true; role: string; userId: string; fullName: string | null } | { ok: false; response: NextResponse }

// Internal helper — queries influencer_profiles to decide if a staff user is an influencer.
// Uses the authenticated client so the RLS "read own profile" policy covers it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkIsInfluencer(userId: string, supabase: SupabaseClient<any>): Promise<boolean> {
  const { data } = await supabase
    .from('influencer_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

export type AdminUser = { id: string; full_name: string | null }

/**
 * Lightweight drop-in replacement for the inline getAdminUser() pattern.
 * Returns { id, full_name } when the caller is an admin, null otherwise.
 * Never throws — callers should check for null and return 403.
 */
export async function requireAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  if (data?.role !== 'admin') return null
  return { id: user.id, full_name: (data?.full_name as string | null) ?? null }
}

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

  return { ok: true, role: 'admin', userId: user.id, fullName: null }
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
    .select('role, staff_active, full_name')
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

  // Influencer accounts (role='staff' + influencer_profiles row) must use
  // /api/v1/influencer/* routes — they are denied all staff routes.
  if (profile?.role === 'staff' && await checkIsInfluencer(user.id, supabase)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'influencer_account' }, { status: 403 }),
    }
  }

  return { ok: true, role: profile?.role ?? 'staff', userId: user.id, fullName: (profile?.full_name as string | null) ?? null }
}

/**
 * Guards routes that only influencer accounts may call.
 * Regular staff and admin are denied — influencer-specific routes only.
 */
export async function requireInfluencerAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff') {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti ya influencer inahitajika' }, { status: 403 }) }
  }

  if (profile?.staff_active === false) {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti imezimwa' }, { status: 403 }) }
  }

  const { data: influencerProfile } = await supabase
    .from('influencer_profiles')
    .select('id, referral_code, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!influencerProfile) {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti ya influencer haipatikani' }, { status: 403 }) }
  }

  if (!influencerProfile.is_active) {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti ya influencer imezimwa' }, { status: 403 }) }
  }

  return { ok: true, role: 'influencer', userId: user.id, fullName: (profile?.full_name as string | null) ?? null }
}

/**
 * Allows admin OR staff with whatsapp_support permission.
 * Used by all WhatsApp session action routes (takeover, send, handback, resolve).
 */
export async function requireWhatsAppSupportUser(): Promise<(AdminUser & { role: string }) | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('role, full_name, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(data?.role ?? '')) return null

  if (data?.role === 'staff') {
    if (data?.staff_active === false) return null
    const { hasPermission } = await import('@/lib/staff/checkPermission')
    const allowed = await hasPermission(user.id, 'whatsapp_support')
    if (!allowed) return null
  }

  return {
    id: user.id,
    full_name: (data?.full_name as string | null) ?? null,
    role: data?.role as string,
  }
}
