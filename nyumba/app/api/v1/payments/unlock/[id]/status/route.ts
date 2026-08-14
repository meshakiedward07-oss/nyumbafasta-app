import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ status: 'unknown' }, { status: 401 })

    const { id } = await params
    const admin = createAdminClient()

    const { data } = await admin
      .from('contact_unlocks')
      .select('status')
      .eq('id', id)
      .eq('client_id', user.id)
      .maybeSingle()

    return NextResponse.json({ status: data?.status ?? 'not_found' })
  } catch {
    return NextResponse.json({ status: 'unknown' })
  }
}
