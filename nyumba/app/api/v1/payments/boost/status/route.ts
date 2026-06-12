import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
  }

  const paymentRef = req.nextUrl.searchParams.get('ref')
  if (!paymentRef) return NextResponse.json({ error: 'ref inahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('boost_payments')
    .select('id, status, boosted_until')
    .eq('payment_ref', paymentRef)
    .eq('dalali_id', user.id)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ status: 'not_found' })
  return NextResponse.json({ status: data.status, boosted_until: data.boosted_until })
}
