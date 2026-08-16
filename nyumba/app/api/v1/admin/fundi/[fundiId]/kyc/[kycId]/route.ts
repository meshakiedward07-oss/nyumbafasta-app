import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ fundiId: string; kycId: string }> }

// PATCH /api/v1/admin/fundi/:fundiId/kyc/:kycId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { fundiId, kycId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { action, rejection_reason } = body
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action lazima iwe approve au reject' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const kycUpdates: Record<string, unknown> = {
      status:      action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: now,
    }
    if (action === 'reject') kycUpdates.rejection_reason = rejection_reason?.trim() || null

    const { error: kycErr } = await admin.from('fundi_kyc').update(kycUpdates).eq('id', kycId).eq('fundi_user_id', fundiId)
    if (kycErr) throw kycErr

    await admin.from('fundi_profiles').update({ kyc_status: action === 'approve' ? 'approved' : 'rejected', updated_at: now }).eq('user_id', fundiId)

    // In-app notification to fundi
    try {
      await admin.from('notifications').insert({
        user_id: fundiId,
        type:    action === 'approve' ? 'kyc_approved' : 'kyc_rejected',
        title:   action === 'approve' ? 'KYC Imeidhinishwa ✓' : 'KYC Ilikataliwa',
        body:    action === 'approve'
          ? 'Hati yako ya KYC imeidhinishwa. Unaweza sasa kupata kazi kutoka kwa mashirika.'
          : `Hati yako ilikataliwa.${rejection_reason?.trim() ? ' Sababu: ' + rejection_reason.trim() : ' Tuma hati sahihi.'}`,
        data:    { kyc_id: kycId },
        read:    false,
      })
    } catch { /* non-fatal */ }

    // WhatsApp notification to fundi
    ;(async () => {
      try {
        const { data: fundiUser } = await admin.from('users').select('phone, full_name').eq('id', fundiId).maybeSingle()
        if (!fundiUser?.phone) return
        const { sendTextMessage, formatPhoneNumber } = await import('@/lib/whatsapp/client')
        const msg = action === 'approve'
          ? `✅ *NyumbaFasta — KYC Imeidhinishwa*\n\nHabari ${fundiUser.full_name ?? 'Fundi'}!\n\nHati yako ya KYC imeidhinishwa. Sasa unaweza kupata kazi kutoka kwa mashirika kwenye NyumbaFasta.\n\nIngia: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'}/fundi/dashboard`
          : `❌ *NyumbaFasta — KYC Ilikataliwa*\n\nHabari ${fundiUser.full_name ?? 'Fundi'}!\n\nHati yako ya KYC ilikataliwa.${rejection_reason?.trim() ? '\nSababu: ' + rejection_reason.trim() : ''}\n\nTuma hati sahihi: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'}/fundi/kyc`
        sendTextMessage(formatPhoneNumber(fundiUser.phone), msg).catch(() => {})
      } catch { /* non-fatal */ }
    })().catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /admin/fundi/:id/kyc/:kycId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
