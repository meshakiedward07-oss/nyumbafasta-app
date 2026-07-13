import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/v1/notifications — fetch notifications for current user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const countOnly = req.nextUrl.searchParams.get('count') === 'true'

    if (countOnly) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      return NextResponse.json({ unread_count: count ?? 0 })
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, ref_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unread = notifications?.filter(n => !n.is_read).length ?? 0

    return NextResponse.json({ notifications: notifications ?? [], unread_count: unread })
  } catch (e) {
    console.error('Notifications GET error:', e)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/notifications — mark all as read (or specific IDs)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const ids: string[] | undefined = body.ids

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (ids && ids.length > 0) {
      query = query.in('id', ids) as typeof query
    }

    await query

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Notifications PATCH error:', e)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
