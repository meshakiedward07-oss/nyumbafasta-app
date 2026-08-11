import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; leaseId: string; paymentId: string } }

// PATCH /api/v1/organizations/:id/leases/:leaseId/payments/:paymentId/proof
// Tenant or org uploads payment proof (bank statement / receipt URL)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId, paymentId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Allow: tenant of this lease, org members, or admin/staff
    const [leaseRes, { count: membership }, { data: profile }] = await Promise.all([
      admin.from('leases').select('tenant_id, org_id').eq('id', leaseId).eq('org_id', orgId).maybeSingle(),
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])

    if (!leaseRes.data) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    const isTenant     = leaseRes.data.tenant_id === user.id
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!isTenant && !membership && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    // Verify payment belongs to this lease
    const { data: payment } = await admin
      .from('lease_payments')
      .select('id, status, lease_id')
      .eq('id', paymentId)
      .eq('lease_id', leaseId)
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'Malipo hayapatikani' }, { status: 404 })
    if (['paid', 'void'].includes(payment.status)) {
      return NextResponse.json({ error: 'Malipo haya hayawezi kubadilishwa tena' }, { status: 409 })
    }

    const body = await req.json()
    const { proof_url, proof_note } = body
    if (!proof_url?.trim()) return NextResponse.json({ error: 'Kiungo cha ushahidi kinahitajika' }, { status: 400 })

    const now = new Date().toISOString()
    const { data: updated, error } = await admin
      .from('lease_payments')
      .update({
        proof_url:          proof_url.trim(),
        proof_note:         proof_note?.trim() || null,
        proof_uploaded_at:  now,
        status:             'proof_uploaded',
        updated_at:         now,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (error) throw error

    // Notify org owner that proof has been uploaded (non-fatal)
    ;(async () => {
      const { data: ownerRow } = await admin
        .from('organization_members')
        .select('user:users(id, phone, full_name)')
        .eq('organization_id', orgId)
        .eq('role', 'owner')
        .maybeSingle()

      const owner = ownerRow?.user as unknown as { id: string; phone: string | null; full_name: string } | null
      if (!owner) return

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

      try {
        await admin.from('notifications').insert({
          user_id: owner.id,
          title:   '📤 Ushahidi wa Malipo Umepakiwa',
          body:    `Mpangaji amepakia ushahidi wa malipo. Tafadhali thibitisha ili kusasisha rekodi za kodi.`,
          type:    'rent_proof_uploaded',
          is_read: false,
          data:    JSON.stringify({ payment_id: paymentId, lease_id: leaseId, org_id: orgId }),
        })
      } catch { /* non-fatal */ }

      if (owner.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `📤 *NyumbaFasta — Ushahidi wa Malipo*\n\n` +
          `Mpangaji amepakia ushahidi wa malipo ya kodi.\n\n` +
          `Tafadhali ingia dashibodini uone na uthibitishe:\n` +
          `👉 ${appUrl}/property/wapangaji/${leaseId}`
        sendTextMessage(formatPhoneNumber(owner.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ payment: updated })
  } catch (err) {
    console.error('[PATCH /payments/:paymentId/proof]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
