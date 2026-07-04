import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const month = searchParams.get('month')
  const year  = searchParams.get('year') ?? String(new Date().getFullYear())

  const admin = createAdminClient()
  let query = admin
    .from('dalali_income')
    .select('*')
    .eq('dalali_id', user.id)
    .order('date', { ascending: false })
    .limit(200)

  if (month) {
    const y = parseInt(year), m = parseInt(month)
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const monthEnd   = new Date(y, m, 1).toISOString().split('T')[0]
    query = query.gte('date', monthStart).lt('date', monthEnd)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ income: data })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { amount, category, date, description, client_name, listing_title, payment_method } = body
  if (!amount || !category || !date)
    return NextResponse.json({ error: 'amount, category, date zinahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('dalali_income')
    .insert({
      dalali_id: user.id,
      amount: parseInt(String(amount)),
      category,
      date,
      description:    description    || null,
      client_name:    client_name    || null,
      listing_title:  listing_title  || null,
      payment_method: payment_method || 'cash',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, income: data })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('dalali_income').delete().eq('id', id).eq('dalali_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
