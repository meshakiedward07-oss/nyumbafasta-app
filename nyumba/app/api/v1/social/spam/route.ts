import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getSpamStats, processCommentForSpam } from '@/lib/social/spamDetector'
import { hideIGComment } from '@/lib/social/metaClient'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'

async function getAuthorisedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, staff_active').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(data?.role ?? '')) return null
  if (data?.role === 'staff') {
    if (data?.staff_active === false) return null
    const allowed = await hasPermission(user.id, 'spam_moderation')
    if (!allowed) return null
  }
  return { ...user, role: data?.role as string }
}

// GET /api/v1/social/spam — spam stats + recent
export async function GET() {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const stats = await getSpamStats()
    return NextResponse.json(stats)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/social/spam]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/social/spam — manually mark a comment as spam and delete it
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { commentId, platform, commentText, commenterId, postId } = await req.json() as {
      commentId:   string
      platform:    'instagram' | 'facebook'
      commentText: string
      commenterId: string
      postId:      string
    }

    if (!commentId || !platform) {
      return NextResponse.json({ error: 'commentId na platform zinahitajika' }, { status: 400 })
    }

    const result = await processCommentForSpam({
      platform,
      commentId,
      postId:        postId ?? '',
      commenterId:   commenterId ?? '',
      commenterName: '',
      commentText:   commentText ?? '',
    })

    logStaffActivity({
      staffId:      actor.id,
      actionType:   'comment_moderated',
      resourceType: 'spam_comments',
      resourceId:   commentId,
      description:  `Alithibitisha spam kwenye ${platform}: "${commentText?.slice(0, 60)}"`,
    }).catch(() => {})

    return NextResponse.json({ ok: true, ...result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/social/spam]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/social/spam — restore a falsely flagged comment (unhide)
export async function PATCH(req: NextRequest) {
  try {
    const actor = await getAuthorisedUser()
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { spamId, commentId, platform } = await req.json() as {
      spamId:    string
      commentId: string
      platform:  'instagram' | 'facebook'
    }

    if (platform === 'instagram') {
      await hideIGComment(commentId, false)  // unhide
    }

    await supabaseAdmin
      .from('spam_comments')
      .update({ action_taken: 'ignored' })
      .eq('id', spamId)

    logStaffActivity({
      staffId:      actor.id,
      actionType:   'comment_moderated',
      resourceType: 'spam_comments',
      resourceId:   spamId,
      description:  `Alirudisha comment iliyoflagiwa kwa makosa (${platform})`,
    }).catch(() => {})

    return NextResponse.json({ ok: true, restored: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/social/spam]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
