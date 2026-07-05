import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { title, target_amount, month, year } = body
  if (!title || !target_amount || !month || !year)
    return NextResponse.json({ error: 'Taarifa zote zinahitajika' }, { status: 400 })

  const admin = createAdminClient()

  const parsedMonth = parseInt(String(month))
  const parsedYear  = parseInt(String(year))

  // Check if goal already exists — update only title/target_amount to preserve current_amount
  const { data: existing } = await admin
    .from('dalali_goals')
    .select('id')
    .eq('dalali_id', user.id)
    .eq('month', parsedMonth)
    .eq('year', parsedYear)
    .maybeSingle()

  let data, error

  if (existing) {
    const result = await admin
      .from('dalali_goals')
      .update({ title, target_amount: parseInt(String(target_amount)) })
      .eq('id', existing.id)
      .select()
      .single()
    data  = result.data
    error = result.error
  } else {
    const result = await admin
      .from('dalali_goals')
      .insert({
        dalali_id:      user.id,
        title,
        target_amount:  parseInt(String(target_amount)),
        month:          parsedMonth,
        year:           parsedYear,
        current_amount: 0,
      })
      .select()
      .single()
    data  = result.data
    error = result.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, goal: data })
}
