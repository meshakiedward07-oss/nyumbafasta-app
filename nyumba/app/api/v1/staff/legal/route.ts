import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = [
  'nida_number', 'date_of_birth', 'nationality', 'marital_status',
  'tin_number', 'nssf_number', 'nhif_number',
  'bank_name', 'bank_account_number', 'bank_branch',
  'mobile_money_network', 'mobile_money_number',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [legalResult, docsResult, payrollResult] = await Promise.all([
    admin.from('staff_legal_info').select('*').eq('staff_id', user.id).maybeSingle(),
    admin.from('staff_documents').select('*').eq('staff_id', user.id).order('uploaded_at', { ascending: false }),
    admin.from('staff_payroll').select('*').eq('staff_id', user.id).maybeSingle(),
  ])

  return NextResponse.json({
    legalInfo: legalResult.data ?? null,
    documents: docsResult.data ?? [],
    payroll:   payrollResult.data ?? null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await admin
    .from('staff_legal_info').select('verification_status').eq('staff_id', user.id).maybeSingle()

  if (existing?.verification_status === 'verified') {
    return NextResponse.json(
      { error: 'Taarifa zimeshathihibitiwa na admin. Wasiliana na admin kufanya mabadiliko.' },
      { status: 400 }
    )
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const payload: Record<string, unknown> = { staff_id: user.id, updated_at: new Date().toISOString() }
  for (const key of ALLOWED_FIELDS) {
    if (key in body) payload[key] = body[key] || null
  }

  if (existing?.verification_status === 'rejected') {
    payload.verification_status = 'pending'
    payload.rejection_reason = null
  } else if (!existing) {
    payload.verification_status = 'pending'
  }

  const { data, error } = await admin
    .from('staff_legal_info').upsert(payload, { onConflict: 'staff_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, legalInfo: data })
}
