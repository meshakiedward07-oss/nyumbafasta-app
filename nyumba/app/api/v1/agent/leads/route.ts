/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const region = searchParams.get('region') || ''
    const source = searchParams.get('source') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 50
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('agent_leads')
      .select('*', { count: 'exact' })
      .order('ai_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (region) query = query.eq('region', region)
    if (source) query = query.eq('source', source)
    if (status) query = query.eq('status', status)
    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({
      leads: data || [],
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit)
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, notes } = body

    const { data, error } = await supabaseAdmin
      .from('agent_leads')
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, lead: data })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
