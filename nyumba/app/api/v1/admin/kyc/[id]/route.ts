import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/admin/kyc/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { data: submission, error } = await admin
      .from('kyc_submissions')
      .select(`
        id, status, submitted_at, reviewed_at, notes, rejection_reason,
        id_document_url, title_deed_url, tax_cert_url,
        landlord:users!landlord_id(id, full_name, phone, email, avatar_url, created_at, role),
        reviewer:users!reviewed_by(id, full_name),
        service_request:service_requests!service_request_id(
          id, request_type, status, description, notes,
          listing:listings(id, title, region, district, type, status)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !submission) return NextResponse.json({ error: 'Haipatikani' }, { status: 404 })

    // Also fetch landlord's other KYC history
    const { data: history } = await admin
      .from('kyc_submissions')
      .select('id, status, submitted_at, reviewed_at')
      .eq('landlord_id', (submission.landlord as unknown as { id: string }).id)
      .neq('id', id)
      .order('submitted_at', { ascending: false })
      .limit(5)

    return NextResponse.json({ submission, history: history ?? [] })
  } catch (err) {
    console.error('[GET /admin/kyc/:id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/admin/kyc/:id  — review action
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const body = await req.json()
    const { action, notes, rejection_reason } = body
    // action: 'approve' | 'reject' | 'needs_more_info' | 'reset'

    const VALID_ACTIONS = ['approve', 'reject', 'needs_more_info', 'reset']
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Hatua haijulikani' }, { status: 400 })
    }
    if (action === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json({ error: 'Sababu ya kukataa inahitajika' }, { status: 400 })
    }

    const statusMap: Record<string, string> = {
      approve:        'approved',
      reject:         'rejected',
      needs_more_info:'needs_more_info',
      reset:          'pending',
    }

    const updates: Record<string, unknown> = {
      status:           statusMap[action],
      reviewed_by:      action === 'reset' ? null : user.id,
      reviewed_at:      action === 'reset' ? null : new Date().toISOString(),
      notes:            notes?.trim() || null,
      rejection_reason: action === 'reject' ? rejection_reason.trim() : null,
    }

    const { data: submission, error } = await admin
      .from('kyc_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // If approved — also update the linked service_request status
    if (action === 'approve') {
      await admin
        .from('service_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', submission.service_request_id)

      // Optionally promote landlord role to dalali if still 'client'
      const { data: landlord } = await admin
        .from('users')
        .select('role')
        .eq('id', submission.landlord_id)
        .single()

      if (landlord?.role === 'client') {
        await admin
          .from('users')
          .update({ role: 'dalali' })
          .eq('id', submission.landlord_id)
      }
    }

    return NextResponse.json({ submission })
  } catch (err) {
    console.error('[PATCH /admin/kyc/:id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
