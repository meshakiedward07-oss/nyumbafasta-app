import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

const AD_TYPES = ['banner', 'search', 'nearby', 'video', 'featured', 'directory', 'bundle']

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ad_slot_config')
    .select('*')
    .order('ad_type')
    .order('region')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { ad_type, region, max_slots } = body

  if (!AD_TYPES.includes(ad_type)) {
    return NextResponse.json({ error: 'Aina ya tangazo si sahihi' }, { status: 400 })
  }
  if (!region || typeof region !== 'string') {
    return NextResponse.json({ error: 'Mkoa unahitajika' }, { status: 400 })
  }
  const slots = parseInt(max_slots)
  if (!slots || slots < 1 || slots > 50) {
    return NextResponse.json({ error: 'Idadi lazima iwe kati ya 1 na 50' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ad_slot_config')
    .upsert({ ad_type, region, max_slots: slots }, { onConflict: 'ad_type,region' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('ad_slot_config').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
