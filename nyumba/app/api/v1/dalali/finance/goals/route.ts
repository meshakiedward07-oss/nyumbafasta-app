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

  // Upsert — one goal per month per dalali
  const { data, error } = await admin
    .from('dalali_goals')
    .upsert({
      dalali_id:     user.id,
      title,
      target_amount: parseInt(String(target_amount)),
      month:         parseInt(String(month)),
      year:          parseInt(String(year)),
      current_amount: 0,
    }, { onConflict: 'dalali_id,month,year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, goal: data })
}
