import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })

  const admin = createAdminClient()
  const [legalResult, docsResult, payrollResult] = await Promise.all([
    admin.from('staff_legal_info').select('*').eq('staff_id', params.id).maybeSingle(),
    admin.from('staff_documents').select('*').eq('staff_id', params.id).order('uploaded_at', { ascending: false }),
    admin.from('staff_payroll').select('*').eq('staff_id', params.id).maybeSingle(),
  ])

  return NextResponse.json({
    legalInfo: legalResult.data ?? null,
    documents: docsResult.data ?? [],
    payroll:   payrollResult.data ?? null,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const { action, docId, adminNotes, rejectionReason } = body as {
    action: string
    docId?: string
    adminNotes?: string
    rejectionReason?: string
  }

  if (action === 'verify_info') {
    const { error } = await admin.from('staff_legal_info').update({
      verification_status: 'verified',
      verified_by: adminUser.id,
      verified_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
      rejection_reason: null,
    }).eq('staff_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    void Promise.resolve(admin.from('notifications').insert({
      user_id: params.id,
      type: 'legal_verified',
      title: 'Taarifa Zako Zimethihibitiwa ✅',
      body: 'Taarifa zako za kisheria zimekaguliwa na kuthibitiwa na admin wa NyumbaFasta.',
    }))
    return NextResponse.json({ ok: true, message: 'Taarifa zimethihibitiwa' })
  }

  if (action === 'reject_info') {
    const { error } = await admin.from('staff_legal_info').update({
      verification_status: 'rejected',
      verified_by: adminUser.id,
      verified_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? null,
      admin_notes: adminNotes ?? null,
    }).eq('staff_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    void Promise.resolve(admin.from('notifications').insert({
      user_id: params.id,
      type: 'legal_rejected',
      title: 'Taarifa Zako Zimekataliwa',
      body: rejectionReason
        ? `Taarifa za kisheria zimekataliwa: ${rejectionReason}. Sasishe na uwasilishe tena.`
        : 'Taarifa zako za kisheria zimekataliwa. Sasisha na uwasilishe tena.',
    }))
    return NextResponse.json({ ok: true, message: 'Taarifa zimekataliwa' })
  }

  if (action === 'verify_doc' && docId) {
    const { error } = await admin.from('staff_documents').update({
      is_verified: true,
      verified_by: adminUser.id,
      verified_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    }).eq('id', docId).eq('staff_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: 'Hati imethihibitiwa' })
  }

  if (action === 'unverify_doc' && docId) {
    const { error } = await admin.from('staff_documents').update({
      is_verified: false, verified_by: null, verified_at: null,
    }).eq('id', docId).eq('staff_id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action haijulikani' }, { status: 400 })
}
