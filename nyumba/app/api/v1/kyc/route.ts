import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/kyc — fetch current user's latest KYC submission
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data } = await admin
      .from('kyc_submissions')
      .select('id, status, submitted_at, reviewed_at, notes, rejection_reason, id_document_url, title_deed_url, tax_cert_url')
      .eq('landlord_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ submission: data ?? null })
  } catch {
    return NextResponse.json({ submission: null })
  }
}

// POST /api/v1/kyc — submit or re-submit KYC documents
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const body  = await req.json()
    const { id_document_url, title_deed_url, tax_cert_url, notes } = body

    if (!id_document_url?.trim()) {
      return NextResponse.json({ error: 'Picha ya kitambulisho inahitajika' }, { status: 400 })
    }

    // Check for existing pending/needs_more_info submission — update instead of creating new
    const { data: existing } = await admin
      .from('kyc_submissions')
      .select('id, service_request_id, status')
      .eq('landlord_id', user.id)
      .in('status', ['pending', 'needs_more_info'])
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    let serviceRequestId: string

    if (existing) {
      // Update existing submission
      serviceRequestId = existing.service_request_id
      await admin
        .from('kyc_submissions')
        .update({
          id_document_url: id_document_url.trim(),
          title_deed_url:  title_deed_url?.trim()  || null,
          tax_cert_url:    tax_cert_url?.trim()    || null,
          notes:           notes?.trim()           || null,
          status:          'pending',
          submitted_at:    new Date().toISOString(),
          reviewed_by:     null,
          reviewed_at:     null,
          rejection_reason:null,
        })
        .eq('id', existing.id)

      await admin
        .from('service_requests')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', serviceRequestId)

      return NextResponse.json({ ok: true, resubmitted: true })
    }

    // Create new service_request + kyc_submission
    const { data: sr, error: srErr } = await admin
      .from('service_requests')
      .insert({
        landlord_id:  user.id,
        request_type: 'kyc_only',
        status:       'pending',
        title:        'KYC — Uthibitisho wa Umiliki',
        description:  'Ombi la kuthibitisha hati za kumiliki mali.',
      })
      .select()
      .single()

    if (srErr || !sr) throw srErr ?? new Error('service_request create failed')

    const { data: kyc, error: kycErr } = await admin
      .from('kyc_submissions')
      .insert({
        service_request_id: sr.id,
        landlord_id:        user.id,
        status:             'pending',
        id_document_url:    id_document_url.trim(),
        title_deed_url:     title_deed_url?.trim()  || null,
        tax_cert_url:       tax_cert_url?.trim()    || null,
        notes:              notes?.trim()           || null,
      })
      .select()
      .single()

    if (kycErr) throw kycErr

    return NextResponse.json({ ok: true, submission: kyc }, { status: 201 })
  } catch (err) {
    console.error('[POST /kyc]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
