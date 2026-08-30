import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'
import { sanitizeBlogHtml } from '@/lib/blog/sanitize'
import { slugify } from '@/lib/blog/slug'

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

// GET /api/v1/social/blog/:id — single post (for the editor)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Haikupatikana' }, { status: 404 })

    return NextResponse.json({ post: data })
  } catch (err) {
    console.error('[GET app/api/v1/social/blog/:id]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/social/blog/:id — edit / publish / unpublish
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
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

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('blog_posts')
      .select('id, status, published_at')
      .eq('id', id)
      .single()
    if (fetchErr || !existing) return NextResponse.json({ error: 'Haikupatikana' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}
    if (body.title !== undefined)            update.title = body.title.trim()
    if (body.slug !== undefined && body.slug.trim()) update.slug = slugify(body.slug)
    if (body.excerpt !== undefined)          update.excerpt = body.excerpt?.trim() || null
    if (body.content_html !== undefined)     update.content_html = sanitizeBlogHtml(body.content_html)
    if (body.cover_image_url !== undefined)  update.cover_image_url = body.cover_image_url || null
    if (body.category !== undefined)         update.category = body.category?.trim() || null
    if (body.tags !== undefined)             update.tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : []
    if (body.meta_title !== undefined)       update.meta_title = body.meta_title?.trim() || null
    if (body.meta_description !== undefined) update.meta_description = body.meta_description?.trim() || null

    if (body.status && body.status !== existing.status) {
      update.status = body.status
      // Only stamp published_at the FIRST time a post goes live — flipping
      // back to draft and republishing later shouldn't reset its original
      // publish date (keeps the timeline honest for returning readers/SEO).
      if (body.status === 'published' && !existing.published_at) {
        update.published_at = new Date().toISOString()
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('blog_posts')
      .update(update)
      .eq('id', id)

    if (updateErr) {
      if (updateErr.code === '23505') {
        return NextResponse.json({ error: 'Slug hii tayari inatumika kwenye chapisho lingine' }, { status: 409 })
      }
      throw updateErr
    }

    await logStaffActivity({
      staffId: actor.id,
      actionType: 'blog_post_updated',
      resourceType: 'blog_post',
      resourceId: id,
      description: `Alihariri andiko la blog${body.status ? ` (hali: ${body.status})` : ''}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH app/api/v1/social/blog/:id]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/social/blog/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { error } = await supabaseAdmin.from('blog_posts').delete().eq('id', id)
    if (error) throw error

    await logStaffActivity({
      staffId: actor.id,
      actionType: 'blog_post_deleted',
      resourceType: 'blog_post',
      resourceId: id,
      description: 'Alifuta andiko la blog',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE app/api/v1/social/blog/:id]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
