import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data } = await admin
      .from('dalali_report_downloads')
      .select('id, month, year, downloaded_at')
      .eq('dalali_id', user.id)
      .order('downloaded_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ downloads: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /finance/report/downloads]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body?.month || !body?.year)
      return NextResponse.json({ error: 'month na year zinahitajika' }, { status: 400 })

    const admin = createAdminClient()
    await admin.from('dalali_report_downloads').insert({
      dalali_id:    user.id,
      month:        parseInt(String(body.month)),
      year:         parseInt(String(body.year)),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /finance/report/downloads]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
