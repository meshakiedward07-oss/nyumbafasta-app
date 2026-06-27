import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { classificationId, replyText } = await req.json() as {
    classificationId: string
    replyText:        string
  }

  if (!classificationId || !replyText?.trim()) {
    return NextResponse.json({ error: 'classificationId na replyText zinahitajika' }, { status: 400 })
  }

  const { data: msg } = await supabaseAdmin
    .from('message_classifications')
    .select('*')
    .eq('id', classificationId)
    .single()

  if (!msg) return NextResponse.json({ error: 'Ujumbe haukupatikana' }, { status: 404 })

  let sent = false

  // Send via appropriate platform
  if (msg.platform === 'whatsapp' && msg.sender_phone) {
    const { sendTextMessage } = await import('@/lib/whatsapp/client')
    sent = await sendTextMessage(msg.sender_phone as string, replyText.trim())
  }

  if ((msg.platform === 'instagram' || msg.platform === 'facebook') && msg.sender_id) {
    const { sendIGDM, sendFBMessage } = await import('@/lib/social/metaClient')
    try {
      if (msg.platform === 'instagram') {
        await sendIGDM(msg.sender_id as string, replyText.trim())
      } else {
        await sendFBMessage(msg.sender_id as string, replyText.trim())
      }
      sent = true
    } catch (err) {
      console.error('[InboxReply] Send failed:', err)
    }
  }

  if (sent) {
    await supabaseAdmin
      .from('message_classifications')
      .update({
        action:           'owner_replied',
        owner_reply:      replyText.trim(),
        owner_replied_at: new Date().toISOString(),
      })
      .eq('id', classificationId)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Imeshindwa kutuma jibu' }, { status: 500 })
}
