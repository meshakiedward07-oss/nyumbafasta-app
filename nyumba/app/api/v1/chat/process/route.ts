import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// n8n calls this endpoint directly — no auth header needed (internal only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform = 'whatsapp', userId, phone, name, message, mediaUrls } = body

    if (!userId || !message) {
      return NextResponse.json({ success: false, reply: 'Samahani, tuma ujumbe tena. 🙏' })
    }

    const reply = await handleIncomingMessage(platform, userId, message, phone, name, mediaUrls)

    return NextResponse.json({ success: true, reply, userId, phone: phone || userId, platform })
  } catch (err: unknown) {
    console.error('Process error:', err)
    return NextResponse.json({
      success: false,
      reply: 'Samahani, tatizo la kiufundi. 🙏',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
