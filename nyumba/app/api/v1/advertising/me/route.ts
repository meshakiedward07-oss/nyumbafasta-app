import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

export async function GET() {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response
  return NextResponse.json({ advertiser: auth.advertiser })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const allowed = ['business_name', 'business_category', 'contact_phone', 'whatsapp_number',
                   'city', 'district', 'description', 'logo_url', 'website_url']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (updates.whatsapp_number && typeof updates.whatsapp_number === 'string') {
    updates.whatsapp_number = normalizePhone(updates.whatsapp_number) || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('advertisers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', auth.advertiser.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ advertiser: data })
}
