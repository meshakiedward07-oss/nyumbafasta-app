import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { nida_number, nida_image_front, nida_image_back, selfie_image, whatsapp_number } = await req.json()

    if (!nida_number?.trim() || !nida_image_front || !nida_image_back || !selfie_image) {
      return NextResponse.json({ error: 'Taarifa zote zinahitajika' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if dalali_profiles row exists and has whatsapp_number
    const { data: existing } = await admin
      .from('dalali_profiles')
      .select('user_id, whatsapp_number')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no profile row or no whatsapp, require it
    if (!existing || !existing.whatsapp_number) {
      if (!whatsapp_number?.trim()) {
        return NextResponse.json({ error: 'Nambari ya WhatsApp inahitajika' }, { status: 400 })
      }
    }

    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      nida_number: nida_number.trim(),
      nida_image_front,
      nida_image_back,
      selfie_image,
      verification_status: 'pending',
      verification_submitted_at: new Date().toISOString(),
      verification_rejected_reason: null,
    }

    // Provide whatsapp_number when creating or updating empty one
    if (!existing?.whatsapp_number && whatsapp_number?.trim()) {
      upsertData.whatsapp_number = whatsapp_number.trim()
    } else if (!existing) {
      upsertData.whatsapp_number = whatsapp_number?.trim() ?? ''
    }

    const { error } = await admin
      .from('dalali_profiles')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
