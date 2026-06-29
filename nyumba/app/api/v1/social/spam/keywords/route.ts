import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/social/spam/keywords
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: keywords } = await supabaseAdmin
    .from('spam_keywords')
    .select('*')
    .order('match_count', { ascending: false })

  return NextResponse.json({ keywords: keywords ?? [] })
}

// POST /api/v1/social/spam/keywords — add keyword
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { keyword, category } = await req.json() as { keyword: string; category?: string }

  if (!keyword?.trim()) {
    return NextResponse.json({ error: 'keyword inahitajika' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('spam_keywords')
    .insert({
      keyword:    keyword.trim().toLowerCase(),
      category:   category ?? 'general',
      created_by: admin.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Neno hilo lipo tayari' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, keyword: data })
}

// PATCH /api/v1/social/spam/keywords — toggle active
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, isActive } = await req.json() as { id: string; isActive: boolean }

  const { error } = await supabaseAdmin
    .from('spam_keywords')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/v1/social/spam/keywords — remove keyword
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json() as { id: string }

  const { error } = await supabaseAdmin
    .from('spam_keywords')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
