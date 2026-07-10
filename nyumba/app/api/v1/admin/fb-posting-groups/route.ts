import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/admin/fb-posting-groups
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('fb_posting_groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/v1/admin/fb-posting-groups
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    group_id:   string
    group_name: string
    group_url:  string
    category?:  string
    notes?:     string
  }

  if (!body.group_id?.trim() || !body.group_name?.trim()) {
    return NextResponse.json({ error: 'group_id na group_name vinahitajika' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('fb_posting_groups')
    .insert({
      group_id:   body.group_id.trim(),
      group_name: body.group_name.trim(),
      group_url:  body.group_url?.trim() || null,
      category:   body.category ?? 'nyumba',
      notes:      body.notes?.trim() || null,
      is_active:  true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Group hii tayari ipo kwenye orodha' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/v1/admin/fb-posting-groups  (toggle active, update name)
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { id: string; is_active?: boolean; group_name?: string; notes?: string }
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

  // Explicit allowlist — prevent mass assignment of fields like group_id, post_count, created_at
  const updates: Record<string, unknown> = {}
  if (body.is_active   !== undefined) updates.is_active   = body.is_active
  if (body.group_name  !== undefined) updates.group_name  = body.group_name
  if (body.notes       !== undefined) updates.notes       = body.notes

  const db = createAdminClient()
  const { data, error } = await db
    .from('fb_posting_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/v1/admin/fb-posting-groups
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('fb_posting_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
