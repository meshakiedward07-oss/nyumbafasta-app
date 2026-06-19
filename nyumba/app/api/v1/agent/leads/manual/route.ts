import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const body = await req.json() as {
      business_name: string
      phone?: string
      email?: string
      region?: string
      notes?: string
    }
    const { business_name, phone, email, region, notes } = body

    if (!business_name) {
      return NextResponse.json(
        { error: 'Jina la biashara linahitajika' },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('agent_leads')
      .insert({
        business_name,
        phone:    phone    || null,
        email:    email    || null,
        region:   region   || null,
        source:   'manual',
        ai_score: 50,
        status:   'new',
        notes:    notes    || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, lead: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
