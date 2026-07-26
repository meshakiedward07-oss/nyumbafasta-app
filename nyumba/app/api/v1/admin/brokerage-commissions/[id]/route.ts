import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// PATCH /api/v1/admin/brokerage-commissions/:id
// action: 'invoice' | 'collect' | 'overdue' | 'reset'
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const body  = await req.json()
    const { action, proof_url, notes } = body

    const VALID = ['invoice', 'collect', 'overdue', 'reset']
    if (!VALID.includes(action)) {
      return NextResponse.json({ error: 'Hatua si sahihi' }, { status: 400 })
    }
    if (action === 'collect' && !proof_url?.trim()) {
      return NextResponse.json({ error: 'Uthibitisho wa malipo (proof_url) unahitajika' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: now }

    switch (action) {
      case 'invoice':
        updates.collection_status = 'invoiced'
        updates.invoice_sent_at   = now
        break
      case 'collect':
        updates.collection_status = 'collected'
        updates.collected_at      = now
        updates.collected_by      = auth.userId
        updates.proof_url         = proof_url.trim()
        break
      case 'overdue':
        updates.collection_status = 'overdue'
        break
      case 'reset':
        updates.collection_status = 'pending'
        updates.invoice_sent_at   = null
        updates.collected_at      = null
        updates.collected_by      = null
        updates.proof_url         = null
        break
    }

    if (notes !== undefined) updates.notes = notes?.trim() || null

    const { data, error } = await admin
      .from('brokerage_commissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ commission: data })
  } catch (err) {
    console.error('[PATCH /admin/brokerage-commissions/:id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
