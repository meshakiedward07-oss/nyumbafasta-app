import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; invoiceId: string }> }

// PATCH /api/v1/organizations/[id]/invoices/[invoiceId]
// Org use: upload proof (proof_url, proof_note) — only when status=pending|proof_uploaded
// Admin use: same endpoint (admin can patch any field; they use /admin/invoices/[id] for confirm/void)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, invoiceId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: m }, { data: u }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(u?.role ?? '')
    if (!isAdminStaff && m?.role !== 'owner') {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    // Fetch current invoice to verify it belongs to this org
    const { data: current } = await admin
      .from('subscription_invoices')
      .select('id, status, org_id')
      .eq('id', invoiceId)
      .eq('org_id', id)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Ankara haikupatikana' }, { status: 404 })

    if (!isAdminStaff && !['pending', 'proof_uploaded'].includes(current.status)) {
      return NextResponse.json({ error: 'Ankara hii haiwezi kubadilishwa tena' }, { status: 409 })
    }

    const body       = await req.json()
    const now        = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: now }

    const { proof_url, proof_note } = body
    if ('proof_url' in body) {
      updates.proof_url         = proof_url?.trim() || null
      updates.proof_note        = proof_note?.trim() || null
      updates.proof_uploaded_at = proof_url?.trim() ? now : null
      updates.status            = proof_url?.trim() ? 'proof_uploaded' : 'pending'
    }

    const { data, error } = await admin
      .from('subscription_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select('*, plan:subscription_plans(id, name, price_tzs)')
      .single()

    if (error) throw error
    return NextResponse.json({ invoice: data })
  } catch (err) {
    console.error('[PATCH /organizations/[id]/invoices/[invoiceId]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
