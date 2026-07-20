import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cache } from '@/lib/cache/memoryCache'

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dalali_commissions')
    .select('*')
    .eq('dalali_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commissions: data })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { client_name, property_title, expected_amount, due_date, notes } = body
  if (!client_name || !property_title || !expected_amount)
    return NextResponse.json({ error: 'client_name, property_title, expected_amount zinahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dalali_commissions')
    .insert({
      dalali_id:       user.id,
      client_name,
      property_title,
      expected_amount: parseInt(String(expected_amount)),
      due_date:        due_date || null,
      notes:           notes    || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  cache.invalidatePrefix(`finance-stats:${user.id}:`)
  return NextResponse.json({ success: true, commission: data })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch existing to determine if paid_amount >= expected_amount
  const { data: existing } = await admin
    .from('dalali_commissions')
    .select('expected_amount')
    .eq('id', body.id)
    .eq('dalali_id', user.id)
    .maybeSingle()

  const update: Record<string, unknown> = {}
  if (body.paid_amount !== undefined) {
    const paidAmount = parseInt(String(body.paid_amount))
    update.paid_amount = paidAmount
    if (existing && paidAmount >= existing.expected_amount) {
      update.status = 'paid'
    }
  }
  if (body.notes !== undefined) update.notes = body.notes

  const { data, error } = await admin
    .from('dalali_commissions')
    .update(update)
    .eq('id', body.id)
    .eq('dalali_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  cache.invalidatePrefix(`finance-stats:${user.id}:`)
  return NextResponse.json({ success: true, commission: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('dalali_commissions').delete().eq('id', id).eq('dalali_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  cache.invalidatePrefix(`finance-stats:${user.id}:`)
  return NextResponse.json({ success: true })
}
