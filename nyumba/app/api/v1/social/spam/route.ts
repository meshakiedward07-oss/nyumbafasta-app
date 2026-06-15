import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getSpamStats, processCommentForSpam } from '@/lib/social/spamDetector'
import { hideIGComment } from '@/lib/social/metaClient'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/social/spam — spam stats + recent
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stats = await getSpamStats()
  return NextResponse.json(stats)
}

// POST /api/v1/social/spam — manually mark a comment as spam and delete it
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  return NextResponse.json({ ok: true, ...result })
}

// PATCH /api/v1/social/spam/[id] — restore a falsely flagged comment (unhide)
// DELETE logic is handled here with query param restore=true
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  return NextResponse.json({ ok: true, restored: true })
}
