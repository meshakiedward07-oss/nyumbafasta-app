import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nyumbafasta-chat',
    platform: 'baileys+n8n',
    time: new Date().toISOString(),
  })
}

// Baileys/n8n sends POST here with JSON body
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    const n8nSecret = req.headers.get('x-n8n-secret')

    const validSecret =
      secret === process.env.WEBHOOK_SECRET ||
      n8nSecret === process.env.WEBHOOK_SECRET ||
      process.env.NODE_ENV === 'development'

    if (!validSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { platform = 'whatsapp', userId, phone, name, message, mediaUrls } = body

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId na message zinahitajika' },
        { status: 400 },
      )
    }

    const reply = await handleIncomingMessage(
      platform,
      userId,
      message,
      phone,
      name,
      mediaUrls,
    )

    return NextResponse.json({ success: true, reply, userId, phone: phone || userId, platform })
  } catch (err: unknown) {
    console.error('Chat webhook error:', err)
    return NextResponse.json(
      {
        success: false,
        reply: 'Samahani, kuna tatizo la kiufundi. Jaribu tena. 🙏',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
