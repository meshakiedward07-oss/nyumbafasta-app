/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, newToday, contacted, converted] = await Promise.all([
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
    ])

    return NextResponse.json({
      total: total.count || 0,
      new_today: newToday.count || 0,
      contacted: contacted.count || 0,
      converted: converted.count || 0
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
