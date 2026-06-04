/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('agent_leads')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { count } = await supabaseAdmin
      .from('agent_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      last_run: data?.created_at || null,
      leads_today: count || 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
