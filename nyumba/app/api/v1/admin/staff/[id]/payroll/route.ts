import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED = [
  'basic_salary', 'house_allowance', 'transport_allowance', 'meal_allowance',
  'phone_allowance', 'other_allowances', 'other_allowances_notes',
  'nssf_employee', 'nhif_employee', 'paye_tax',
  'other_deductions', 'other_deductions_notes',
  'effective_from', 'payment_method', 'notes',
]

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin.from('staff_payroll').select('*').eq('staff_id', params.id).maybeSingle()
  return NextResponse.json({ payroll: data ?? null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const payload: Record<string, unknown> = {
    staff_id:   params.id,
    set_by:     adminUser.id,
    updated_at: new Date().toISOString(),
  }
  for (const key of ALLOWED) {
    if (key in body) payload[key] = body[key]
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('staff_payroll')
    .upsert(payload, { onConflict: 'staff_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify staff of payroll update
  void Promise.resolve(admin.from('notifications').insert({
    user_id: params.id,
    type:    'payroll_updated',
    title:   'Mshahara Wako Umesasishwa',
    body:    'Admin amesasisha muundo wa mshahara wako. Angalia sehemu ya Taarifa Zangu.',
  }))

  return NextResponse.json({ ok: true, payroll: data })
}
