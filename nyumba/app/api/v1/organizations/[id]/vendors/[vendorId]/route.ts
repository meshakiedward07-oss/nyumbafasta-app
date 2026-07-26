import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; vendorId: string } }

// PATCH /api/v1/organizations/:id/vendors/:vendorId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, vendorId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: existing } = await admin.from('vendors').select('org_id, verification_status').eq('id', vendorId).maybeSingle()
    if (!existing || existing.org_id !== orgId) return NextResponse.json({ error: 'Mchezaji hapatikani' }, { status: 404 })

    const body = await req.json()
    const { action, rejection_reason } = body

    const now = new Date().toISOString()

    // ── verify / reject — admin/staff only ──
    if (action === 'verify' || action === 'reject') {
      if (!isAdminStaff) return NextResponse.json({ error: 'Ni admin/staff tu anaweza kuthibitisha' }, { status: 403 })
      const verificationUpdates: Record<string, unknown> = { updated_at: now }
      if (action === 'verify') {
        verificationUpdates.verification_status = 'verified'
        verificationUpdates.verified_by         = user.id
        verificationUpdates.verified_at         = now
        verificationUpdates.rejection_reason    = null
      } else {
        verificationUpdates.verification_status = 'rejected'
        verificationUpdates.rejection_reason    = rejection_reason?.trim() || null
        verificationUpdates.verified_by         = null
        verificationUpdates.verified_at         = null
      }
      const { data: vendor, error } = await admin.from('vendors').update(verificationUpdates).eq('id', vendorId).select().single()
      if (error) throw error

      // Notify the org owner about verification result
      ;(async () => {
        try {
          const { data: org } = await admin.from('organizations').select('created_by, name').eq('id', orgId).maybeSingle()
          if (!org?.created_by) return
          const title = action === 'verify' ? 'Mchezaji Amethibitishwa ✓' : 'Mchezaji Alikataliwa'
          const notifBody = action === 'verify'
            ? `${vendor.name} amethibitishwa na sasa anaonekana kwenye orodha ya wachuuzi.`
            : `${vendor.name} alikataliwa.${rejection_reason ? ' Sababu: ' + rejection_reason : ''}`
          await admin.from('notifications').insert({
            user_id: org.created_by,
            type:    action === 'verify' ? 'vendor_verified' : 'vendor_rejected',
            title,
            body:    notifBody,
            data:    { vendor_id: vendorId, org_id: orgId },
            read:    false,
          })
        } catch { /* non-fatal */ }
      })().catch(() => {})

      return NextResponse.json({ vendor })
    }

    // ── regular field update ──
    const { name, category, phone, email, specialty, location, notes, is_active, rating_avg } = body

    const updates: Record<string, unknown> = { updated_at: now }
    if (name      !== undefined) updates.name      = name?.trim() || existing
    if (category  !== undefined) updates.category  = category
    if (phone     !== undefined) updates.phone     = phone?.trim()     || null
    if (email     !== undefined) updates.email     = email?.trim()     || null
    if (specialty !== undefined) updates.specialty = specialty?.trim() || null
    if (location  !== undefined) updates.location  = location?.trim()  || null
    if (notes     !== undefined) updates.notes     = notes?.trim()     || null
    if (is_active !== undefined) updates.is_active = is_active
    if (rating_avg !== undefined) updates.rating_avg = rating_avg

    // Non-admin edits reset verification to pending so admin re-approves
    const fieldsThatResetVerification = ['name', 'category', 'phone', 'email', 'specialty', 'location', 'notes']
    const editingContentFields = fieldsThatResetVerification.some(f => body[f] !== undefined)
    if (!isAdminStaff && editingContentFields && existing.verification_status === 'verified') {
      updates.verification_status = 'pending'
      updates.verified_by         = null
      updates.verified_at         = null
    }

    const { data: vendor, error } = await admin.from('vendors').update(updates).eq('id', vendorId).select().single()
    if (error) throw error
    return NextResponse.json({ vendor })
  } catch (err) {
    console.error('[PATCH /organizations/:id/vendors/:vendorId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/organizations/:id/vendors/:vendorId  (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: orgId, vendorId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: existing } = await admin.from('vendors').select('org_id').eq('id', vendorId).maybeSingle()
    if (!existing || existing.org_id !== orgId) return NextResponse.json({ error: 'Mchezaji hapatikani' }, { status: 404 })

    await admin.from('vendors').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', vendorId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /organizations/:id/vendors/:vendorId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
