import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET — fetch leads assigned to the current staff member (or specific staff if admin)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }
  if (profile?.role === 'staff' && profile?.staff_active === false) {
    return NextResponse.json({ error: 'Akaunti imezimwa' }, { status: 403 })
  }

  const isAdmin = profile?.role === 'admin'

  try {
    const { searchParams } = new URL(req.url)
    const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit   = Math.min(200, parseInt(searchParams.get('limit') || '50'))
    const offset  = (page - 1) * limit
    const search  = searchParams.get('search')  || ''
    const quality = searchParams.get('quality') || ''
    const status  = searchParams.get('status')  || ''

    // Staff only sees their own leads; admin can filter by a specific staff member
    const targetUserId = isAdmin
      ? (searchParams.get('assigned_to') || null)
      : user.id

    let q = supabaseAdmin
      .from('leads')
      .select(
        'id,full_name,phone,phone_2,email,ward,district,region,lead_type,source,notes,' +
        'facebook_url,instagram_url,tiktok_url,whatsapp_number,' +
        'facebook_status,instagram_status,tiktok_status,whatsapp_status,' +
        'social_score,contact_quality,has_valid_phone,has_any_social,' +
        'is_dead_lead,is_duplicate,status,contacted_at,assigned_to,created_at',
        { count: 'exact' },
      )
      .eq('is_duplicate', false)
      .eq('is_dead_lead', false)

    if (targetUserId) {
      q = q.eq('assigned_to', targetUserId)
    } else {
      // Admin with no specific filter → all assigned leads
      q = q.not('assigned_to', 'is', null)
    }

    if (quality) q = q.eq('contact_quality', quality)
    if (status)  q = q.eq('status', status)
    if (search) {
      q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,ward.ilike.%${search}%,district.ilike.%${search}%`)
    }

    const { data, count, error } = await q
      .order('social_score', { ascending: false })
      .order('created_at',   { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      leads: data || [],
      pagination: {
        page, limit,
        total:      count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext:    offset + limit < (count || 0),
        hasPrev:    page > 1,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — staff can update status/notes on their assigned leads
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }
  if (profile?.role === 'staff' && profile?.staff_active === false) {
    return NextResponse.json({ error: 'Akaunti imezimwa' }, { status: 403 })
  }

  try {
    const { id, ...updates } = await req.json() as Record<string, unknown>
    if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

    // Staff can only update their assigned leads; whitelist editable fields
    const allowed: Record<string, unknown> = {}
    if ('status'       in updates) allowed.status       = updates.status
    if ('notes'        in updates) allowed.notes        = updates.notes
    if ('contacted_at' in updates) allowed.contacted_at = updates.contacted_at
    allowed.updated_at = new Date().toISOString()

    // Confirm this lead is assigned to the current user (skip check for admin)
    if (profile?.role === 'staff') {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('assigned_to')
        .eq('id', id as string)
        .single()
      if (lead?.assigned_to !== user.id) {
        return NextResponse.json({ error: 'Lead hii si yako' }, { status: 403 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(allowed)
      .eq('id', id as string)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, lead: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
