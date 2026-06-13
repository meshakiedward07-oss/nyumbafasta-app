import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getSocialStats, updateAllPostMetrics } from '@/lib/social/metricsTracker'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/social/posts?tab=posts|comments|dms|schedule|stats&limit=20&offset=0
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const tab    = searchParams.get('tab') ?? 'posts'
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  switch (tab) {
    case 'stats': {
      const stats = await getSocialStats()
      return NextResponse.json({ stats })
    }

    case 'posts': {
      const { data, count } = await supabaseAdmin
        .from('social_posts')
        .select('*, listings(title, type, district, region)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      return NextResponse.json({ posts: data ?? [], total: count ?? 0 })
    }

    case 'comments': {
      const { data, count } = await supabaseAdmin
        .from('social_comments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      return NextResponse.json({ comments: data ?? [], total: count ?? 0 })
    }

    case 'dms': {
      const { data, count } = await supabaseAdmin
        .from('social_dms')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      return NextResponse.json({ dms: data ?? [], total: count ?? 0 })
    }

    case 'schedule': {
      const { data, count } = await supabaseAdmin
        .from('post_schedule')
        .select('*, listings(title, type, district)', { count: 'exact' })
        .order('scheduled_at', { ascending: true })
        .range(offset, offset + limit - 1)
      return NextResponse.json({ schedule: data ?? [], total: count ?? 0 })
    }

    default:
      return NextResponse.json({ error: 'tab haijulikani' }, { status: 400 })
  }
}

// POST /api/v1/social/posts — trigger metrics refresh
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await req.json() as { action?: string }

  if (action === 'refresh_metrics') {
    const result = await updateAllPostMetrics()
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json({ error: 'action haijulikani' }, { status: 400 })
}
