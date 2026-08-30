import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'
import { sanitizeBlogHtml } from '@/lib/blog/sanitize'
import { slugify } from '@/lib/blog/slug'

// Same auth pattern as app/api/v1/social/spam/route.ts — admin, or staff
// with the existing 'social_media' permission (the same one that already
// gates the whole /admin/social panel this lives inside). No new
// permission key needed.
async function getAuthorisedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, staff_active, full_name').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(data?.role ?? '')) return null
  if (data?.role === 'staff') {
    if (data?.staff_active === false) return null
    const allowed = await hasPermission(user.id, 'social_media')
    if (!allowed) return null
  }
  return { id: user.id, role: data?.role as string, fullName: (data?.full_name as string | null) ?? null }
}

// GET /api/v1/social/blog — list posts.
//   ?mine=1        → only the current user's own posts ("see their product")
//   ?status=draft|published
export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const mine   = searchParams.get('mine') === '1'
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, category, status, author_id, author_name, view_count, published_at, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (mine) query = query.eq('author_id', actor.id)
    if (status === 'draft' || status === 'published') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ posts: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/social/blog]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/social/blog — create a new post (draft or published)
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      title?: string
      slug?: string
      excerpt?: string
      content_html?: string
      cover_image_url?: string
      category?: string
      tags?: string[]
      status?: 'draft' | 'published'
      meta_title?: string
      meta_description?: string
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Kichwa cha habari kinahitajika' }, { status: 400 })
    }

    const slug = (body.slug?.trim() ? slugify(body.slug) : slugify(body.title))
    if (!slug) {
      return NextResponse.json({ error: 'Slug si sahihi — tumia herufi/namba' }, { status: 400 })
    }

    const status = body.status === 'published' ? 'published' : 'draft'

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        title:            body.title.trim(),
        slug,
        excerpt:          body.excerpt?.trim() || null,
        content_html:     sanitizeBlogHtml(body.content_html ?? ''),
        cover_image_url:  body.cover_image_url || null,
        category:         body.category?.trim() || null,
        tags:             Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
        status,
        author_id:        actor.id,
        author_name:      actor.fullName,
        meta_title:       body.meta_title?.trim() || null,
        meta_description: body.meta_description?.trim() || null,
        published_at:     status === 'published' ? new Date().toISOString() : null,
      })
      .select('id, slug')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug hii tayari inatumika kwenye chapisho lingine' }, { status: 409 })
      }
      throw error
    }

    await logStaffActivity({
      staffId: actor.id,
      actionType: 'blog_post_created',
      resourceType: 'blog_post',
      resourceId: data.id,
      description: `Alichapisha andiko jipya la blog: "${body.title.trim()}" (${status})`,
    })

    return NextResponse.json({ success: true, id: data.id, slug: data.slug })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/social/blog]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
