import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET /api/v1/conversations/contacts?type=staff|dalali|org|tenant&q=search
// Returns contact options for starting internal conversations.
export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const sp   = req.nextUrl.searchParams
  const type = sp.get('type') ?? 'staff'
  const q    = sp.get('q')?.trim().toLowerCase() ?? ''

  if (type === 'org') {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id, name, org_type, logo_url, status, created_by')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(100)

    const filtered = (data ?? []).filter((o) =>
      !q || o.name.toLowerCase().includes(q)
    )
    return NextResponse.json({ contacts: filtered.map((o) => ({
      id:         o.id,
      name:       o.name,
      subtitle:   o.org_type,
      avatar_url: o.logo_url,
      type:       'org',
      org_id:     o.id,
      owner_id:   o.created_by,
    })) })
  }

  const roleMap: Record<string, string[]> = {
    staff:  ['admin', 'staff'],
    dalali: ['dalali'],
    tenant: ['tenant', 'org_owner'],
  }
  const roles = roleMap[type] ?? ['admin', 'staff']

  const { data } = await supabaseAdmin
    .from('users')
    .select('id, full_name, avatar_url, role, phone')
    .in('role', roles)
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(150)

  const filtered = (data ?? []).filter((u) =>
    !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.phone ?? '').includes(q)
  )

  return NextResponse.json({ contacts: filtered.map((u) => ({
    id:         u.id,
    name:       u.full_name ?? 'Mtumiaji',
    subtitle:   u.phone ?? u.role,
    avatar_url: u.avatar_url,
    type:       u.role,
    user_id:    u.id,
  })) })
}
