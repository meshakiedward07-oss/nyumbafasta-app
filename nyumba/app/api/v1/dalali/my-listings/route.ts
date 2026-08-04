import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('listings')
      .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, share_count, created_at, is_boosted, boosted_until, expires_at')
      .eq('dalali_id', user.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      // Fallback: select only base columns that definitely exist
      const { data: fallback, error: fallbackErr } = await admin
        .from('listings')
        .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, created_at, is_boosted')
        .eq('dalali_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(100)

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
      return NextResponse.json(fallback ?? [])
    }

    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
