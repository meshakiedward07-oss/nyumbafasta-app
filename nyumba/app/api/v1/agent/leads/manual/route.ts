/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { business_name, phone, email, region, notes } = body

    if (!business_name) {
      return NextResponse.json(
        { error: 'Jina la biashara linahitajika' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('agent_leads')
      .insert({
        business_name,
        phone: phone || null,
        email: email || null,
        region: region || null,
        source: 'manual',
        ai_score: 50,
        status: 'new',
        notes: notes || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
