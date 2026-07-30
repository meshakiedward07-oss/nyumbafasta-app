import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { replyToIGComment, replyToFBComment } from '@/lib/social/metaClient'

export const dynamic = 'force-dynamic'

// POST /api/v1/social/comments — admin manual reply to a social comment
// Body: { commentId, platform, message }
export async function POST(req: NextRequest) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  try {
    const { commentId, platform, message } = await req.json() as {
      commentId: string
      platform: 'instagram' | 'facebook'
      message: string
    }

    if (!commentId || !platform || !message?.trim()) {
      return NextResponse.json({ error: 'commentId, platform na message zinahitajika' }, { status: 400 })
    }

    if (platform === 'instagram') {
      await replyToIGComment(commentId, message.trim())
    } else if (platform === 'facebook') {
      await replyToFBComment(commentId, message.trim())
    } else {
      return NextResponse.json({ error: 'Platform haijulikani' }, { status: 400 })
    }

    // Mark as replied in DB
    await supabaseAdmin
      .from('social_comments')
      .update({
        reply_sent: true,
        reply_text: message.trim(),
        replied_at: new Date().toISOString(),
        replied_by: auth.userId ?? null,
      })
      .eq('comment_id', commentId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/v1/social/comments]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
