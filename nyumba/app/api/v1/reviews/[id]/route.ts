import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { action } = body
    const admin = createAdminClient()

    // ── Helpful vote — auth required to prevent inflation ────
    if (action === 'helpful') {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

      const { data: review } = await admin
        .from('reviews')
        .select('helpful_count')
        .eq('id', params.id)
        .single()

      if (!review) return NextResponse.json({ error: 'Review haipatikani' }, { status: 404 })

      await admin
        .from('reviews')
        .update({ helpful_count: (review.helpful_count ?? 0) + 1 })
        .eq('id', params.id)

      return NextResponse.json({ ok: true })
    }

    // ── Dalali reply — auth required ─────────────────────
    if (action === 'reply') {
      const { response } = body
      if (!response?.trim()) {
        return NextResponse.json({ error: 'Jibu haliwezi kuwa tupu' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

      // Verify this dalali owns this review
      const { data: review } = await admin
        .from('reviews')
        .select('id, dalali_id, reviewer_id')
        .eq('id', params.id)
        .single()

      if (!review) return NextResponse.json({ error: 'Review haipatikani' }, { status: 404 })
      if (review.dalali_id !== user.id) {
        return NextResponse.json({ error: 'Huna ruhusa kujibu review hii' }, { status: 403 })
      }

      await admin
        .from('reviews')
        .update({ response: response.trim(), response_at: new Date().toISOString() })
        .eq('id', params.id)

      // Notify the reviewer
      await admin.from('notifications').insert({
        user_id: review.reviewer_id,
        title: '💬 Dalali amejibu review yako',
        body: 'Dalali amejibu maoni yako — angalia sasa.',
        type: 'review_reply',
        is_read: false,
        data: { review_id: params.id },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Action si sahihi' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE — admin can delete a review
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    await admin.from('reviews').delete().eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
