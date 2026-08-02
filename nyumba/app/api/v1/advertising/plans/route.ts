import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ad_subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(
      { plans: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/advertising/plans]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
