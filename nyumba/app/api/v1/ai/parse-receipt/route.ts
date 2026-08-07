import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseReceiptText } from '@/lib/ocr/parseReceipt'

// POST /api/v1/ai/parse-receipt
// Accepts { text: string } — raw OCR output from the client.
// Returns structured payment fields extracted with regex. No AI, no cost.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const body = await req.json() as { text?: string }
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text inahitajika' }, { status: 400 })
    }

    const parsed = parseReceiptText(body.text)
    return NextResponse.json({ parsed })
  } catch (err) {
    console.error('[POST /ai/parse-receipt]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
