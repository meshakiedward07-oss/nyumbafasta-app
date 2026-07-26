import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/commission-rules
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('commission_rules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ rules: data ?? [] })
  } catch (err) {
    console.error('[GET /admin/commission-rules]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/commission-rules — create new rule (deactivates others)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { rule_type, value, description } = body

    if (!rule_type || value === undefined || value === null) {
      return NextResponse.json({ error: 'rule_type na value zinahitajika' }, { status: 400 })
    }
    if (!['flat_fee', 'percent_first_month', 'percent_annual'].includes(rule_type)) {
      return NextResponse.json({ error: 'Aina ya sheria si sahihi' }, { status: 400 })
    }
    if (Number(value) <= 0) return NextResponse.json({ error: 'Thamani lazima iwe zaidi ya sifuri' }, { status: 400 })

    const admin = createAdminClient()

    // Deactivate all existing active rules
    await admin.from('commission_rules').update({ active: false }).eq('active', true)

    const { data, error } = await admin
      .from('commission_rules')
      .insert({ rule_type, value: Number(value), description: description?.trim() || null, active: true, created_by: auth.userId })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/commission-rules]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
